'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useRents, useProprietors, useProperties, useSubLandlordsQuery, useCurrentTenantsQuery, usePropertiesQuery } from '@/hooks/useStorage';
import { X } from 'lucide-react';
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
    const [showSubLandlordDetail, setShowSubLandlordDetail] = useState<SubLandlord | null>(null);
    const [showChildPropertyModal, setShowChildPropertyModal] = useState(false);
    const [childPropertySaving, setChildPropertySaving] = useState(false);
    const [childPropertyForm, setChildPropertyForm] = useState({ parentId: '', name: '', code: '' });
    const [childPropertyError, setChildPropertyError] = useState('');
    const { data: subLandlords = [] } = useSubLandlordsQuery();
    const { data: currentTenants = [] } = useCurrentTenantsQuery();
    const { data: allProperties = [] } = usePropertiesQuery();

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
                rentCollectionDate: formatDate((rent as any).rentCollectionDate || rent.startDate),
                rentCollectionEndDate: formatDate(rent.endDate),
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
            rentCollectionEndDate: '',
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

    // Auto-generate rentOutTenancyNumber based on property code and sub-landlord (僅合約記錄)
    useEffect(() => {
        if (formData.type !== 'contract') return;
        if (!formData.propertyId || !formData.rentOutSubLandlordId) return;
        
        const property = properties.find(p => p.id === formData.propertyId);
        const subLandlord = subLandlords.find(sl => sl.id === formData.rentOutSubLandlordId);
        
        if (property?.code && subLandlord) {
            // 格式: 物業編號-二房東合約號碼 (例如: C33-ER033)
            const newNumber = `${property.code}-${subLandlord.tenancyNumber || 'ER' + subLandlord.id?.slice(0, 4).toUpperCase() || 'NEW'}`;
            
            // 只有在用户没有手动输入时才自动生成
            if (!formData.rentOutTenancyNumber || formData.rentOutTenancyNumber === '') {
                setFormData(prev => ({ ...prev, rentOutTenancyNumber: newNumber }));
            }
        }
    }, [formData.type, formData.propertyId, formData.rentOutSubLandlordId, formData.rentOutTenancyNumber, properties, subLandlords]);

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
        if (formData.type === 'rent_out' || formData.type === 'renting') {
            if (!formData.propertyId) {
                setError('請選擇物業');
                return;
            }
            // 業主不是必填，移除验证
            if (!formData.rentCollectionTenantName?.trim()) {
                setError('請填寫租客名稱');
                return;
            }
            // 其他字段都不是必填，但如果有选择付款方式为支票，则需要验证支票相关字段
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
                const paidRaw = String(formData.rentCollectionAmount || '').replace(/,/g, '').trim();
                const paidAmt = parseFloat(paidRaw);
                const hasPaidAmount = paidRaw !== '' && !Number.isNaN(paidAmt);
                rentData = {
                    ...rentData,
                    status: hasPaidAmount ? ('completed' as const) : ('pending' as const),
                    amount: hasPaidAmount ? paidAmt : undefined,
                    startDate: formData.rentCollectionDate ? new Date(formData.rentCollectionDate) : undefined,
                    endDate: formData.rentCollectionEndDate ? new Date(formData.rentCollectionEndDate) : undefined,
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
                    rentCollectionAmount: hasPaidAmount ? paidAmt : null,
                    rentCollectionPaymentMethod: formData.rentCollectionPaymentMethod || undefined,
                    rentCollectionChequeBank: formData.rentCollectionPaymentMethod === 'cheque' ? formData.rentCollectionChequeBank.trim() : undefined,
                    rentCollectionChequeNumber: formData.rentCollectionPaymentMethod === 'cheque' ? formData.rentCollectionChequeNumber.trim() : undefined,
                    rentCollectionChequeImage:
                        (formData.rentCollectionPaymentMethod === 'cheque' || formData.rentCollectionPaymentMethod === 'fps') &&
                        formData.rentCollectionChequeImage
                            ? formData.rentCollectionChequeImage
                            : undefined,
                };
            } else if (formData.type === 'renting') {
                const paidRaw = String(formData.rentCollectionAmount || '').replace(/,/g, '').trim();
                const paidAmt = parseFloat(paidRaw);
                const hasPaidAmount = paidRaw !== '' && !Number.isNaN(paidAmt);
                rentData = {
                    ...rentData,
                    status: hasPaidAmount ? ('completed' as const) : ('pending' as const),
                    amount: hasPaidAmount ? paidAmt : undefined,
                    startDate: formData.rentCollectionDate ? new Date(formData.rentCollectionDate) : undefined,
                    endDate: formData.rentCollectionEndDate ? new Date(formData.rentCollectionEndDate) : undefined,
                    notes: formData.rentCollectionNotes.trim(),
                    rentCollectionTenantName: formData.rentCollectionTenantName.trim(),
                    rentCollectionDate: formData.rentCollectionDate ? new Date(formData.rentCollectionDate) : undefined,
                    rentCollectionAmount: hasPaidAmount ? paidAmt : null,
                    rentCollectionPaymentMethod: formData.rentCollectionPaymentMethod || undefined,
                    rentCollectionChequeBank: formData.rentCollectionPaymentMethod === 'cheque' ? formData.rentCollectionChequeBank.trim() : undefined,
                    rentCollectionChequeNumber: formData.rentCollectionPaymentMethod === 'cheque' ? formData.rentCollectionChequeNumber.trim() : undefined,
                    rentCollectionChequeImage:
                        (formData.rentCollectionPaymentMethod === 'cheque' || formData.rentCollectionPaymentMethod === 'fps') &&
                        formData.rentCollectionChequeImage
                            ? formData.rentCollectionChequeImage
                            : undefined,
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
                                    {(formData.type === 'rent_out' || formData.type === 'renting' || formData.type === 'contract') && (
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
                                    {(formData.type === 'rent_out' || formData.type === 'renting' || formData.type === 'contract') && (
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
                            {(formData.type === 'rent_out' || formData.type === 'renting' || formData.type === 'contract') && (
                                <p className="text-xs text-zinc-400 dark:text-white/40">「+ 子物業」會在主物業下新增一筆子物業，並可立即選用</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>業主</label>
                            <div className="flex gap-2 items-center">
                                {(formData.type === 'rent_out' || formData.type === 'renting' || formData.type === 'contract') ? (
                                    <>
                                        <select
                                            name="tenantId"
                                            value={formData.tenantId}
                                            onChange={handleChange}
                                            className={`${inputClass} flex-1`}
                                        >
                                            <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇業主</option>
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
                            <p className="text-xs text-zinc-400 dark:text-white/40">請按「+ 新增」以新增業主</p>
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
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const sl = subLandlords.find(s => s.id === formData.rentOutSubLandlordId);
                                                        if (sl) {
                                                            setEditSubLandlord(sl);
                                                            // 设置为添加新物业数据模式
                                                            setShowSubLandlordModal(true);
                                                        }
                                                    }}
                                                    className="p-2 text-zinc-400 hover:text-purple-500 rounded-lg shrink-0"
                                                    title="新增二房東資料"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const sl = subLandlords.find(s => s.id === formData.rentOutSubLandlordId);
                                                        if (sl) {
                                                            setShowSubLandlordDetail(sl);
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/20 rounded-lg border border-purple-200 dark:border-purple-500/30 transition-all"
                                                >
                                                    二房東資料
                                                </button>
                                            </div>
                                        )}
                                        {!formData.rentOutSubLandlordId && (
                                            <button
                                                type="button"
                                                onClick={() => { setEditSubLandlord(null); setShowSubLandlordModal(true); }}
                                                className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-[44px] whitespace-nowrap"
                                            >
                                                + 新增
                                            </button>
                                        )}
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

                            <div className="space-y-4">
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
                                    <label className={labelClass}>收租日期（日／月／年 至 日／月／年）</label>
                                    <p className="text-xs text-zinc-500 dark:text-white/45 mb-2">請分別選擇開始與結束日期；列表將以 dd/mm/yyyy 顯示。</p>
                                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                                        <div className="flex-1 space-y-1">
                                            <span className="text-xs text-zinc-500 dark:text-white/50">開始</span>
                                            <input type="date" name="rentCollectionDate" value={formData.rentCollectionDate} onChange={handleChange} className={inputClass} />
                                        </div>
                                        <span className="hidden sm:inline text-zinc-400 dark:text-white/40 pb-3 shrink-0">至</span>
                                        <div className="flex-1 space-y-1">
                                            <span className="text-xs text-zinc-500 dark:text-white/50">結束</span>
                                            <input type="date" name="rentCollectionEndDate" value={formData.rentCollectionEndDate} onChange={handleChange} className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>繳付金額</label>
                                    <input
                                        type="text"
                                        name="rentCollectionAmount"
                                        value={formatNumberWithCommas(formData.rentCollectionAmount)}
                                        onChange={(e) => handlePriceChange('rentCollectionAmount', e.target.value)}
                                        className={inputClass}
                                        placeholder="50,000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>付款方式</label>
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
                                <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-4">交租記錄</h3>
                            </div>

                            <div className="space-y-4">
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
                                    <label className={labelClass}>交租日期（日／月／年 至 日／月／年）</label>
                                    <p className="text-xs text-zinc-500 dark:text-white/45 mb-2">請分別選擇開始與結束日期；列表將以 dd/mm/yyyy 顯示。</p>
                                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                                        <div className="flex-1 space-y-1">
                                            <span className="text-xs text-zinc-500 dark:text-white/50">開始</span>
                                            <input type="date" name="rentCollectionDate" value={formData.rentCollectionDate} onChange={handleChange} className={inputClass} />
                                        </div>
                                        <span className="hidden sm:inline text-zinc-400 dark:text-white/40 pb-3 shrink-0">至</span>
                                        <div className="flex-1 space-y-1">
                                            <span className="text-xs text-zinc-500 dark:text-white/50">結束</span>
                                            <input type="date" name="rentCollectionEndDate" value={formData.rentCollectionEndDate} onChange={handleChange} className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>繳付金額</label>
                                    <input
                                        type="text"
                                        name="rentCollectionAmount"
                                        value={formatNumberWithCommas(formData.rentCollectionAmount)}
                                        onChange={(e) => handlePriceChange('rentCollectionAmount', e.target.value)}
                                        className={inputClass}
                                        placeholder="30,000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>付款方式</label>
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
                                <div className="rounded-xl border border-blue-100 dark:border-blue-500/25 bg-blue-50/40 dark:bg-blue-500/10 p-4 space-y-4">
                                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">支票資料</p>
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
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
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
                                <div className="rounded-xl border border-blue-100 dark:border-blue-500/25 bg-blue-50/40 dark:bg-blue-500/10 p-4 space-y-4">
                                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">FPS 轉帳</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>轉帳證明／截圖（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
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
                    isAddPropertyData={!!editSubLandlord && !!formData.propertyId}
                    currentPropertyCode={formData.propertyId ? properties.find(p => p.id === formData.propertyId)?.code : undefined}
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
            {/* SubLandlord Detail Modal */}
            {showSubLandlordDetail && (
                <SubLandlordDetailModal
                    subLandlord={showSubLandlordDetail}
                    allProperties={allProperties}
                    onClose={() => setShowSubLandlordDetail(null)}
                    onEdit={() => {
                        setEditSubLandlord(showSubLandlordDetail);
                        setShowSubLandlordDetail(null);
                        setShowSubLandlordModal(true);
                    }}
                />
            )}
        </>
    );
}

// Sub-landlord Detail Modal Component
function SubLandlordDetailModal({ 
    subLandlord, 
    allProperties,
    onClose,
    onEdit 
}: { 
    subLandlord: SubLandlord; 
    allProperties: Property[];
    onClose: () => void;
    onEdit: () => void;
}) {
    const relatedProperties = useMemo(() => {
        if (!subLandlord.tenancyNumber) return [];
        
        const parts = subLandlord.tenancyNumber.split(',').map(p => p.trim());
        const propertyCodes = new Set<string>();
        
        parts.forEach(part => {
            const firstDashIndex = part.indexOf('-');
            if (firstDashIndex > 0) {
                const afterDash = part.substring(firstDashIndex + 1);
                if (afterDash.match(/^[A-Z]{2,3}\d+$/)) {
                    propertyCodes.add(part.substring(0, firstDashIndex));
                } else {
                    propertyCodes.add(part);
                }
            } else {
                propertyCodes.add(part);
            }
        });
        
        return allProperties.filter(p => {
            if (!p.code) return false;
            return propertyCodes.has(p.code) || 
                   Array.from(propertyCodes).some(code => {
                       return p.code === code || (code.length <= 4 && p.code.startsWith(code + '-'));
                   });
        });
    }, [subLandlord.tenancyNumber, allProperties]);

    const formatDate = (date: any) => {
        if (!date) return '—';
        return new Date(date).toLocaleDateString('zh-HK');
    };

    const formatNumber = (num: any) => {
        if (!num) return '—';
        return new Intl.NumberFormat('zh-HK').format(num);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-[70] flex flex-col"
            >
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">二房東詳細資料</h2>
                        <p className="text-sm text-zinc-500 dark:text-white/50 mt-1">{subLandlord.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 text-sm font-medium transition-all"
                        >
                            編輯
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="p-5 space-y-6 overflow-y-auto flex-1">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-white/80 mb-3">基本資料</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">名稱</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{subLandlord.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租號碼</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{subLandlord.tenancyNumber || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租月租</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {subLandlord.monthlyRental ? `$${formatNumber(subLandlord.monthlyRental)}` : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租期數</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {subLandlord.periods ? `${subLandlord.periods} 月` : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租總額</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {subLandlord.totalAmount ? `$${formatNumber(subLandlord.totalAmount)}` : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">租務狀態</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {subLandlord.status === 'listing' ? '放盤中' : 
                                     subLandlord.status === 'renting' ? '出租中' : 
                                     subLandlord.status === 'completed' ? '已完租' : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">開始日期</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{formatDate(subLandlord.startDate)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">結束日期</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{formatDate(subLandlord.endDate)}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-white/80 mb-3">
                            關聯物業 ({relatedProperties.length})
                        </h3>
                        {relatedProperties.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-white/50">暫無關聯物業</p>
                        ) : (
                            <div className="space-y-2">
                                {relatedProperties.map(property => (
                                    <div
                                        key={property.id}
                                        className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                                    {property.name}
                                                </p>
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mt-1">
                                                    {property.code} • {property.address}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </>
    );
}
