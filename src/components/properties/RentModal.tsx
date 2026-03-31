'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    useRents,
    useProprietors,
    useProperties,
    useSubLandlordsQuery,
    useCurrentTenantsQuery,
    usePropertiesQuery,
    useRentsWithRelationsQuery,
} from '@/hooks/useStorage';
import { X, ExternalLink, Building2, Calendar } from 'lucide-react';
import { fileToBase64, compressImage, validateImageUpload } from '@/lib/imageUtils';
import type { Proprietor, Property, Rent, RentCollectionPaymentMethod, SubLandlord, CurrentTenant } from '@/lib/db';
import { RENT_OUT_CONTRACT_STATUS_OPTIONS } from '@/lib/rentPaymentDisplay';
import ProprietorModal from '@/components/properties/ProprietorModal';
import RentOutFormModal from '@/components/properties/RentOutFormModal';
import CurrentTenantDetailModal from '@/components/properties/CurrentTenantDetailModal';
import { dedupeRecordsByDisplayName, formatNumberWithCommas, parsePriceInput } from '@/lib/formatters';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[150px] w-full bg-zinc-100 dark:bg-white/5 animate-pulse rounded-xl" />
});

/** 合約新舊排序用（優先建立時間，其次更新時間） */
function rentContractRecencyTs(r: Rent): number {
    const c = r.createdAt ? new Date(r.createdAt).getTime() : 0;
    const u = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
    return Math.max(c, u);
}

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
    /** 由最近合約帶入的預設業主（目前系統使用 tenantId 存放） */
    presetTenantId?: string;
    /** 由最近合約帶入的預設二房東 */
    presetSubLandlordId?: string;
    /** 由最近合約帶入的預設現時租客 */
    presetCurrentTenantId?: string;
    onClose: () => void;
    onSuccess: (rentId: string) => void;
}

const allRentTypes = [
    { value: 'rent_out' as const, label: '收租' },
    { value: 'renting' as const, label: '交租' },
    { value: 'contract' as const, label: '合約記錄' },
];

/** 合約記錄「合約性質」選項 */
const CONTRACT_NATURE_OPTIONS = [
    { value: 'parking', label: '車位' },
    { value: 'temporary_parking', label: '臨時車位' },
    { value: 'rental_venue', label: '租用埸地' },
] as const;

export default function RentModal({
    propertyId,
    defaultLocation,
    defaultType,
    allowedTypes,
    rent,
    initialProprietorId,
    presetTenantId,
    presetSubLandlordId,
    presetCurrentTenantId,
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
    /** 交租：ProprietorModal 完成後寫入 tenantId（業主）或 proprietorId（承租人） */
    const [rentingProprietorPickTarget, setRentingProprietorPickTarget] = useState<'owner' | 'lessee'>('owner');
    /** 開啟 ProprietorModal 時帶入編輯對象；+ 新增時為 null */
    const [proprietorModalInitial, setProprietorModalInitial] = useState<Proprietor | null>(null);
    const [showSubLandlordModal, setShowSubLandlordModal] = useState(false);
    const [showCurrentTenantModal, setShowCurrentTenantModal] = useState(false);
    const [editSubLandlord, setEditSubLandlord] = useState<SubLandlord | null>(null);
    const [editCurrentTenant, setEditCurrentTenant] = useState<CurrentTenant | null>(null);
    const [showSubLandlordDetail, setShowSubLandlordDetail] = useState<SubLandlord | null>(null);
    const [showCurrentTenantDetail, setShowCurrentTenantDetail] = useState<CurrentTenant | null>(null);
    const [showChildPropertyModal, setShowChildPropertyModal] = useState(false);
    const [childPropertySaving, setChildPropertySaving] = useState(false);
    const [childPropertyForm, setChildPropertyForm] = useState({ parentId: '', name: '', code: '' });
    const [childPropertyError, setChildPropertyError] = useState('');
    const { data: subLandlords = [] } = useSubLandlordsQuery();
    const { data: currentTenants = [] } = useCurrentTenantsQuery();
    const { data: allProperties = [] } = usePropertiesQuery();
    const { data: contractsWithRel = [] } = useRentsWithRelationsQuery({ type: 'contract' });

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
                rentOutContractNature: ((): string => {
                    const r = rent as unknown as Record<string, unknown>;
                    const v = r.rentOutContractNature ?? r.rent_out_contract_nature;
                    return typeof v === 'string' && v.trim() ? v.trim() : '';
                })(),
                rentOutDepositReceived:
                    rent.rentOutDepositReceived != null && !Number.isNaN(Number(rent.rentOutDepositReceived))
                        ? String(rent.rentOutDepositReceived)
                        : '',
                rentOutDepositPaymentMethod: ((rent as any).rentOutDepositPaymentMethod || '') as '' | RentCollectionPaymentMethod,
                rentOutDepositReceiptNumber: (rent as any).rentOutDepositReceiptNumber || '',
                rentOutDepositChequeBank: (rent as any).rentOutDepositChequeBank || '',
                rentOutDepositChequeNumber: (rent as any).rentOutDepositChequeNumber || '',
                rentOutDepositChequeImage: (rent as any).rentOutDepositChequeImage || '',
                rentOutDepositPaymentDate: formatDate((rent as any).rentOutDepositPaymentDate),
                rentOutDepositBankInImage: (rent as any).rentOutDepositBankInImage || '',
                rentOutDepositReceiveDate: formatDate(rent.rentOutDepositReceiveDate),
                rentOutDepositReturnDate: formatDate(rent.rentOutDepositReturnDate),
                rentOutDepositReturnAmount: rent.rentOutDepositReturnAmount?.toString() || '',
                rentOutLessor: rent.rentOutLessor || '',
                rentOutAddressDetail: rent.rentOutAddressDetail || defaultLocation || '',
                location: rent.location || rent.rentOutAddressDetail || defaultLocation || '',
                rentOutStatus: (rent.rentOutStatus || 'listing') as 'listing' | 'renting' | 'leasing_in' | 'completed',
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
                rentCollectionPaymentMethod: ((rent as any).rentCollectionPaymentMethod || '') as '' | RentCollectionPaymentMethod,
                rentCollectionChequeBank: (rent as any).rentCollectionChequeBank || '',
                rentCollectionChequeNumber: (rent as any).rentCollectionChequeNumber || '',
                rentCollectionChequeImage: (rent as any).rentCollectionChequeImage || '',
                rentCollectionBankInImage: (rent as any).rentCollectionBankInImage || '',
                rentCollectionNotes: rent.notes || '',
                // 與 rentCollectionDate 一致：必須為 yyyy-mm-dd，否則 type="date" 受控值無效，變更無法寫入 state
                rentCollectionPaymentDate: formatDate((rent as any).rentCollectionPaymentDate),
                rentCollectionContractNumber: (rent as any).rentCollectionContractNumber || '',
                rentCollectionReceiptNumber: (rent as any).rentCollectionReceiptNumber || '',
                rentCollectionContractNature: (rent as any).rentCollectionContractNature || '',
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
            tenantId: presetTenantId || '',
            proprietorId: initialProprietorId || '',
            rentOutTenancyNumber: '',
            rentOutPricing: '',
            rentOutMonthlyRental: '',
            rentOutPeriods: '',
            rentOutTotalAmount: '',
            rentOutStartDate: '',
            rentOutEndDate: '',
            rentOutActualEndDate: '',
            rentOutContractNature: '',
            rentOutDepositReceived: '',
            rentOutDepositPaymentMethod: '' as '' | RentCollectionPaymentMethod,
            rentOutDepositReceiptNumber: '',
            rentOutDepositChequeBank: '',
            rentOutDepositChequeNumber: '',
            rentOutDepositChequeImage: '',
            rentOutDepositPaymentDate: '',
            rentOutDepositBankInImage: '',
            rentOutDepositReceiveDate: '',
            rentOutDepositReturnDate: '',
            rentOutDepositReturnAmount: '',
            rentOutLessor: '',
            rentOutAddressDetail: defaultLocation || '',
            location: defaultLocation || '',
            rentOutStatus: 'listing' as 'listing' | 'renting' | 'leasing_in' | 'completed',
            rentOutDescription: '',
            rentOutSubLandlord: '',
            rentOutSubLandlordId: presetSubLandlordId || '',
            rentOutTenants: [] as string[],
            rentOutTenantId: presetCurrentTenantId || '',
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
            rentCollectionPaymentMethod: '' as '' | RentCollectionPaymentMethod,
            rentCollectionChequeBank: '',
            rentCollectionChequeNumber: '',
            rentCollectionChequeImage: '',
            rentCollectionBankInImage: '',
            rentCollectionNotes: '',
            rentCollectionPaymentDate: '',
            rentCollectionContractNumber: '',
            rentCollectionReceiptNumber: '',
            rentCollectionContractNature: '',
        };
    });

    const contractsOnProperty = useMemo(() => {
        const pid = formData.propertyId;
        if (!pid) return [] as Rent[];
        return (contractsWithRel as Rent[]).filter(
            (r) => r.propertyId === pid && r.type === 'contract' && !(r as any).isDeleted,
        );
    }, [contractsWithRel, formData.propertyId]);

    /** 出租合約號碼：同一號碼取最新一筆合約的時間，清單依「最新合約」優先 */
    const leaseOutContractNumbers = useMemo(() => {
        const leaseOut = contractsOnProperty.filter((r) => (r.rentOutStatus || r.status) !== 'leasing_in');
        const byNum = new Map<string, number>();
        for (const r of leaseOut) {
            const n = (r.rentOutTenancyNumber || '').trim();
            if (!n) continue;
            const t = rentContractRecencyTs(r);
            byNum.set(n, Math.max(byNum.get(n) ?? 0, t));
        }
        return [...byNum.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-HK'))
            .map(([n]) => n);
    }, [contractsOnProperty]);

    const lastContractAutoPropertyIdRef = useRef<string | undefined>(undefined);
    const rentCollectionContractAutoSigRef = useRef('');

    /** 新增模式：切換物業時清空已選合約編號，避免帶到錯誤物業 */
    useEffect(() => {
        if (rent?.id) {
            lastContractAutoPropertyIdRef.current = formData.propertyId;
            return;
        }
        if (lastContractAutoPropertyIdRef.current !== formData.propertyId) {
            lastContractAutoPropertyIdRef.current = formData.propertyId;
            rentCollectionContractAutoSigRef.current = '';
            setFormData((prev) => ({ ...prev, rentCollectionContractNumber: '' }));
        }
    }, [formData.propertyId, rent?.id]);

    /**
     * 新增模式（僅收租）：自動帶入該物業「最新一筆」出租合約編號（清單已依合約新舊排序，首項即最新）。
     * 交租記錄不使用「收租記錄編號」欄位，故不帶入。
     */
    useEffect(() => {
        if (rent?.id) return;
        if (formData.type !== 'rent_out') return;
        const nums = leaseOutContractNumbers;
        if (nums.length === 0) {
            rentCollectionContractAutoSigRef.current = '';
            return;
        }
        const preferred = nums[0];
        const sig = `${formData.propertyId}|${formData.type}|${preferred}`;
        const cur = (formData.rentCollectionContractNumber || '').trim();
        if (cur) {
            rentCollectionContractAutoSigRef.current = `${formData.propertyId}|${formData.type}|${cur}`;
            return;
        }
        if (rentCollectionContractAutoSigRef.current === sig) return;
        rentCollectionContractAutoSigRef.current = sig;
        setFormData((prev) => ({ ...prev, rentCollectionContractNumber: preferred }));
    }, [
        rent?.id,
        formData.type,
        formData.propertyId,
        formData.rentCollectionContractNumber,
        leaseOutContractNumbers,
    ]);

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

    /** 與「管理業主」一致：排除承租人代碼（T 開頭），並依名稱去重 */
    const proprietorSelectOptions = useMemo(() => {
        const owners = proprietors.filter(p => !p.code?.startsWith('T'));
        return dedupeRecordsByDisplayName(owners);
    }, [proprietors]);

    const lesseeIndividuals = useMemo(
        () =>
            proprietorSelectOptions
                .filter(p => p.type === 'individual')
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK')),
        [proprietorSelectOptions]
    );
    const lesseeCompanies = useMemo(
        () =>
            proprietorSelectOptions
                .filter(p => p.type === 'company')
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK')),
        [proprietorSelectOptions]
    );

    /** 承租人下拉：含承租人代碼（T 開頭）等全部業主／承租人資料，與「業主」選單範圍不同 */
    const fullProprietorPickOptions = useMemo(
        () =>
            dedupeRecordsByDisplayName(proprietors)
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-HK')),
        [proprietors],
    );
    const fullPickIndividuals = useMemo(
        () => fullProprietorPickOptions.filter((p) => p.type === 'individual'),
        [fullProprietorPickOptions],
    );
    const fullPickCompanies = useMemo(
        () => fullProprietorPickOptions.filter((p) => p.type === 'company'),
        [fullProprietorPickOptions],
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

    /** 收租／交租「入數」憑證上載（與支票/FPS 影像分開儲存） */
    const onBankInImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        const check = validateImageUpload(formData.rentCollectionBankInImage ? [formData.rentCollectionBankInImage] : [], [file], 'property');
        if (!check.valid) {
            setError(check.error || '圖片無效');
            return;
        }
        try {
            const blob = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.75 });
            const b64 = await fileToBase64(blob);
            setFormData(prev => ({ ...prev, rentCollectionBankInImage: b64 }));
        } catch {
            setError('圖片處理失敗');
        }
    };

    /** 合約按金：支票／FPS 影像（與收租欄位分開） */
    const onDepositChequeImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        const check = validateImageUpload(formData.rentOutDepositChequeImage ? [formData.rentOutDepositChequeImage] : [], [file], 'property');
        if (!check.valid) {
            setError(check.error || '圖片無效');
            return;
        }
        try {
            const blob = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.75 });
            const b64 = await fileToBase64(blob);
            setFormData(prev => ({ ...prev, rentOutDepositChequeImage: b64 }));
        } catch {
            setError('圖片處理失敗');
        }
    };

    /** 合約按金：入數憑證 */
    const onDepositBankInImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        const check = validateImageUpload(formData.rentOutDepositBankInImage ? [formData.rentOutDepositBankInImage] : [], [file], 'property');
        if (!check.valid) {
            setError(check.error || '圖片無效');
            return;
        }
        try {
            const blob = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.75 });
            const b64 = await fileToBase64(blob);
            setFormData(prev => ({ ...prev, rentOutDepositBankInImage: b64 }));
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
        if (formData.type !== 'rent_out' || !formData.rentOutTenantId) return;
        const name = currentTenants.find(t => t.id === formData.rentOutTenantId)?.name?.trim();
        if (!name) return;
        setFormData(prev => {
            if ((prev.rentCollectionTenantName || '').trim() === name) return prev;
            return { ...prev, rentCollectionTenantName: name };
        });
    }, [formData.type, formData.rentOutTenantId, currentTenants]);

    useEffect(() => {
        if (formData.type !== 'renting' || !formData.tenantId) return;
        const ownerName = proprietors.find(p => p.id === formData.tenantId)?.name?.trim();
        if (!ownerName) return;
        setFormData(prev => {
            if ((prev.rentCollectionTenantName || '').trim() === ownerName) return prev;
            return { ...prev, rentCollectionTenantName: ownerName };
        });
    }, [formData.type, formData.tenantId, proprietors]);

    useEffect(() => {
        if (rent) return;
        setFormData(prev => {
            const next = { ...prev };
            if (!next.tenantId && presetTenantId) next.tenantId = presetTenantId;
            if (!next.rentOutSubLandlordId && presetSubLandlordId) next.rentOutSubLandlordId = presetSubLandlordId;
            if (!next.rentOutTenantId && presetCurrentTenantId) next.rentOutTenantId = presetCurrentTenantId;
            return next;
        });
    }, [rent, presetTenantId, presetSubLandlordId, presetCurrentTenantId]);

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
            setFormData((prev) => ({ ...prev, tenantId: id }));
        } else if (formData.type === 'contract') {
            setFormData((prev) => ({ ...prev, tenantId: id }));
        } else if (formData.type === 'renting') {
            if (rentingProprietorPickTarget === 'lessee') {
                setFormData((prev) => ({ ...prev, proprietorId: id }));
            } else {
                setFormData((prev) => ({ ...prev, tenantId: id }));
            }
        }
        setProprietorModalInitial(null);
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
                setError(formData.type === 'rent_out' ? '請填寫租客名稱' : '請填寫業主名稱');
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
        if (formData.type === 'contract' && formData.rentOutDepositPaymentMethod === 'cheque') {
            if (!formData.rentOutDepositChequeBank?.trim()) {
                setError('請填寫按金支票銀行');
                return;
            }
            if (!formData.rentOutDepositChequeNumber?.trim()) {
                setError('請填寫按金支票號碼');
                return;
            }
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

            /** 交租／收租「付款日期」：一律傳 Date 或 null（勿傳 undefined），update 才會寫入或清空欄位 */
            const parseRentCollectionPaymentDate = (): Date | null => {
                const raw = String(formData.rentCollectionPaymentDate || '').trim();
                if (!raw) return null;
                const d = new Date(raw);
                return Number.isNaN(d.getTime()) ? null : d;
            };
            const rentCollectionPaymentDateForSave = parseRentCollectionPaymentDate();

            let rentData: any = { ...baseData };

            if (formData.type === 'rent_out') {
                const paidRaw = String(formData.rentCollectionAmount || '').replace(/,/g, '').trim();
                const paidAmt = parseFloat(paidRaw);
                const hasPaidAmount = paidRaw !== '' && !Number.isNaN(paidAmt);
                // 與「收租記錄編號」一致；同步寫入 rent_out_tenancy_number，列表與未遷移 DB 仍可顯示
                const collectionContractRef = formData.rentCollectionContractNumber?.trim() || null;
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
                    rentOutTenancyNumber: collectionContractRef,
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
                    rentCollectionPaymentDate: rentCollectionPaymentDateForSave,
                    rentCollectionBankInImage:
                        formData.rentCollectionPaymentMethod === 'bank_in'
                            ? formData.rentCollectionBankInImage || null
                            : null,
                    rentCollectionContractNumber: collectionContractRef,
                    rentCollectionReceiptNumber:
                        formData.rentCollectionPaymentMethod !== 'cheque' && formData.rentCollectionPaymentMethod
                            ? formData.rentCollectionReceiptNumber?.trim() || null
                            : null,
                    rentCollectionContractNature: formData.rentCollectionContractNature || null,
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
                    rentCollectionPaymentDate: rentCollectionPaymentDateForSave,
                    rentCollectionBankInImage:
                        formData.rentCollectionPaymentMethod === 'bank_in'
                            ? formData.rentCollectionBankInImage || null
                            : null,
                    // 交租不使用收租記錄編號，儲存時清空欄位
                    rentCollectionContractNumber                            : null,
                    rentCollectionReceiptNumber:
                        formData.rentCollectionPaymentMethod !== 'cheque' && formData.rentCollectionPaymentMethod
                            ? formData.rentCollectionReceiptNumber?.trim() || null
                            : null,
                    rentCollectionContractNature: formData.rentCollectionContractNature || null,
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
                // 合約記錄：以 rentOut* 欄位儲存（已移除實際結束日／出租人／租借地址欄位，寫入時清空舊值）
                const propRow = properties.find(p => p.id === formData.propertyId);
                const contractLocation = (propRow?.address || '').trim() || defaultLocation || '';
                const parseRentOutDepositPaymentDate = (): Date | null => {
                    const raw = String(formData.rentOutDepositPaymentDate || '').trim();
                    if (!raw) return null;
                    const d = new Date(raw);
                    return Number.isNaN(d.getTime()) ? null : d;
                };
                const rentOutDepositPaymentDateForSave = parseRentOutDepositPaymentDate();
                const depositRaw = String(formData.rentOutDepositReceived || '').replace(/,/g, '').trim();
                const depositAmt = parseFloat(depositRaw);
                const hasDepositAmount = depositRaw !== '' && !Number.isNaN(depositAmt);
                rentData = {
                    ...rentData,
                    rentOutTenancyNumber: formData.rentOutTenancyNumber,
                    rentOutPricing: parseFloat(formData.rentOutPricing) || undefined,
                    rentOutMonthlyRental: parseFloat(formData.rentOutMonthlyRental) || undefined,
                    rentOutPeriods: parseInt(formData.rentOutPeriods) || undefined,
                    rentOutTotalAmount: parseFloat(formData.rentOutTotalAmount) || undefined,
                    rentOutStartDate: formData.rentOutStartDate ? new Date(formData.rentOutStartDate) : undefined,
                    rentOutEndDate: formData.rentOutEndDate ? new Date(formData.rentOutEndDate) : undefined,
                    rentOutActualEndDate: null,
                    rentOutContractNature: (() => {
                        const v = String(formData.rentOutContractNature ?? '').trim();
                        return v === '' ? null : v;
                    })(),
                    rentOutDepositReceived: hasDepositAmount ? depositAmt : null,
                    rentOutDepositPaymentMethod: formData.rentOutDepositPaymentMethod || null,
                    rentOutDepositChequeBank:
                        formData.rentOutDepositPaymentMethod === 'cheque' ? formData.rentOutDepositChequeBank.trim() : null,
                    rentOutDepositChequeNumber:
                        formData.rentOutDepositPaymentMethod === 'cheque' ? formData.rentOutDepositChequeNumber.trim() : null,
                    rentOutDepositChequeImage:
                        (formData.rentOutDepositPaymentMethod === 'cheque' || formData.rentOutDepositPaymentMethod === 'fps') &&
                        formData.rentOutDepositChequeImage
                            ? formData.rentOutDepositChequeImage
                            : null,
                    rentOutDepositPaymentDate: rentOutDepositPaymentDateForSave,
                    rentOutDepositBankInImage:
                        formData.rentOutDepositPaymentMethod === 'bank_in'
                            ? formData.rentOutDepositBankInImage || null
                            : null,
                    rentOutDepositReceiptNumber:
                        formData.rentOutDepositPaymentMethod && formData.rentOutDepositPaymentMethod !== 'cheque'
                            ? formData.rentOutDepositReceiptNumber?.trim() || null
                            : null,
                    rentOutDepositReceiveDate: formData.rentOutDepositReceiveDate ? new Date(formData.rentOutDepositReceiveDate) : undefined,
                    rentOutDepositReturnDate: formData.rentOutDepositReturnDate ? new Date(formData.rentOutDepositReturnDate) : undefined,
                    rentOutDepositReturnAmount: parseFloat(formData.rentOutDepositReturnAmount) || undefined,
                    rentOutAddressDetail: null,
                    location: contractLocation,
                    rentOutStatus: formData.rentOutStatus,
                    rentOutDescription: formData.rentOutDescription,
                    rentOutLessor: null,
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
                    // 使租務列表／物業關聯快取失效，避免編輯後仍用舊 rent（例如收租記錄編號看似未儲存）
                    await queryClient.invalidateQueries({ queryKey: ['rents'] });
                    await queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
                    await queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
                    onSuccess(rent.id);
                    onClose();
                } else {
                    setError('更新失敗');
                }
            } else {
                const id = await addRent(rentData);
                if (id) {
                    await queryClient.invalidateQueries({ queryKey: ['rents'] });
                    await queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
                    await queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
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
    /** 交租／收租「付款方式詳情」外框（與交租記錄一致之藍色區塊） */
    const rentPaymentDetailBoxClass =
        'rounded-xl border border-blue-100 dark:border-blue-500/25 bg-blue-50/40 dark:bg-blue-500/10 p-4 space-y-4';
    const rentPaymentDetailTitleClass = 'text-xs font-medium text-blue-700 dark:text-blue-300';

    /** 僅收租：收租記錄編號（依出租合約號碼） */
    const renderCollectionContractRefField = () => {
        const nums = leaseOutContractNumbers;
        const hint =
            '依該物業「出租合約」之合約號碼帶入；多於一筆時請選擇。無合約時可手動輸入。';
        const val = formData.rentCollectionContractNumber || '';
        return (
            <div className="space-y-2">
                <label className={labelClass}>收租記錄編號</label>
                <p className="text-xs text-zinc-500 dark:text-white/45 mb-1">{hint}</p>
                {nums.length > 0 ? (
                    <select
                        name="rentCollectionContractNumber"
                        value={val}
                        onChange={handleChange}
                        className={inputClass}
                    >
                        <option value="">請選擇</option>
                        {val && !nums.includes(val) ? (
                            <option value={val}>{val}（已存）</option>
                        ) : null}
                        {nums.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        type="text"
                        name="rentCollectionContractNumber"
                        value={val}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="暫無合約記錄時可手動填寫"
                    />
                )}
            </div>
        );
    };

    const renderRentCollectionReceiptField = () => (
        <div className="space-y-2">
            <label className={labelClass}>收據號碼</label>
            <input
                type="text"
                name="rentCollectionReceiptNumber"
                value={formData.rentCollectionReceiptNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="選填"
            />
        </div>
    );

    /** 合約按金：非支票時之收據號碼（與收租「收據號碼」同一欄位語意） */
    const renderContractDepositReceiptField = () => (
        <div className="space-y-2">
            <label className={labelClass}>收據號碼</label>
            <input
                type="text"
                name="rentOutDepositReceiptNumber"
                value={formData.rentOutDepositReceiptNumber}
                onChange={handleChange}
                className={inputClass}
                placeholder="選填"
            />
        </div>
    );

    const showOwnerSelect = formData.type === 'contract' || formData.type === 'renting';
    const showSubLandlordSelect = formData.type === 'contract';
    const showCurrentTenantSelect = formData.type === 'contract' || formData.type === 'rent_out';
    /** 合約類型：第一列 物業｜業主，第二列 二房東｜現時租客 */
    const isContractLayout = formData.type === 'contract';
    /** 與管理合約列表分頁一致：租入中 → 租賃，其餘 → 出租 */
    const contractLabelMode = formData.rentOutStatus === 'leasing_in' ? 'lease_in' : 'rent_out';
    const contractSectionPrefix = contractLabelMode === 'rent_out' ? '出租' : '租賃';
    const contractSectionTitleClass =
        contractLabelMode === 'rent_out'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-cyan-700 dark:text-cyan-300';

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

    const ownerSelectField =
        showOwnerSelect ? (
            <div className="space-y-2">
                <label className={labelClass}>業主</label>
                <div className="flex gap-2 items-center flex-nowrap">
                    <select
                        name="tenantId"
                        value={formData.tenantId}
                        onChange={handleChange}
                        className={`${inputClass} flex-1 min-w-0 w-auto`}
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
                                if (p) {
                                    setProprietorModalInitial(p);
                                    setRentingProprietorPickTarget('owner');
                                    setShowProprietorModal(true);
                                }
                            }}
                            className="p-2 text-zinc-400 hover:text-purple-500 rounded-lg shrink-0"
                            title="編輯"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                            </svg>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setProprietorModalInitial(null);
                            setRentingProprietorPickTarget('owner');
                            setShowProprietorModal(true);
                        }}
                        className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-11 whitespace-nowrap shrink-0"
                    >
                        + 新增
                    </button>
                </div>
                <p className="text-xs text-zinc-400 dark:text-white/40">請按「+ 新增」以新增業主</p>
            </div>
        ) : null;

    const subLandlordSelectBlock =
        showSubLandlordSelect ? (
            <div className="space-y-2">
                <label className={labelClass}>二房東</label>
                <div className="flex gap-2 items-center flex-nowrap">
                    <select
                        name="rentOutSubLandlordId"
                        value={formData.rentOutSubLandlordId}
                        onChange={handleChange}
                        className={`${inputClass} flex-1 min-w-0 w-auto`}
                    >
                        <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇二房東</option>
                        {subLandlords.map(sl => (
                            <option key={sl.id} value={sl.id} className="bg-white dark:bg-[#1a1a2e]">
                                {sl.name}
                            </option>
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
                                        setShowSubLandlordModal(true);
                                    }
                                }}
                                className="p-2 text-zinc-400 hover:text-purple-500 rounded-lg shrink-0"
                                title="新增二房東資料"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const sl = subLandlords.find(s => s.id === formData.rentOutSubLandlordId);
                                    if (sl) setShowSubLandlordDetail(sl);
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
                            onClick={() => {
                                setEditSubLandlord(null);
                                setShowSubLandlordModal(true);
                            }}
                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-11 whitespace-nowrap shrink-0"
                        >
                            + 新增
                        </button>
                    )}
                </div>
            </div>
        ) : null;

    const currentTenantSelectBlock =
        showCurrentTenantSelect ? (
            <div className="space-y-2">
                <label className={labelClass}>現時租客</label>
                <div className="flex gap-2 items-center flex-nowrap">
                    <select
                        name="rentOutTenantId"
                        value={formData.rentOutTenantId}
                        onChange={handleChange}
                        className={`${inputClass} flex-1 min-w-0 w-auto`}
                    >
                        <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇現時租客</option>
                        {currentTenants.map(ct => (
                            <option key={ct.id} value={ct.id} className="bg-white dark:bg-[#1a1a2e]">
                                {ct.name}
                            </option>
                        ))}
                    </select>
                    {formData.rentOutTenantId && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const ct = currentTenants.find(t => t.id === formData.rentOutTenantId);
                                    if (ct) {
                                        setEditCurrentTenant(ct);
                                        setShowCurrentTenantModal(true);
                                    }
                                }}
                                className="p-2 text-zinc-400 hover:text-purple-500 rounded-lg shrink-0"
                                title="編輯"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                </svg>
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setEditCurrentTenant(null);
                            setShowCurrentTenantModal(true);
                        }}
                        className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 h-11 whitespace-nowrap shrink-0"
                    >
                        + 新增
                    </button>
                </div>
            </div>
        ) : null;

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

                    {/* 物業／業主／二房東／現時租客；合約時第一列 物業｜業主、第二列 二房東｜現時租客 */}
                    <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 物業 */}
                        <div className="space-y-2">
                            <label className={labelClass}>物業 *</label>
                            {propertyId ? (
                                <div className="flex gap-2 items-center flex-nowrap">
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
                                <div className="flex gap-2 items-center flex-nowrap">
                                    <select
                                        name="propertyId"
                                        value={formData.propertyId}
                                        onChange={handleChange}
                                        required
                                        className={`${inputClass} flex-1 min-h-[44px] min-w-0 w-auto`}
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

                        {isContractLayout ? (
                            ownerSelectField
                        ) : (
                            <>
                                {(showSubLandlordSelect || showCurrentTenantSelect) && (
                                    <div className="space-y-3">
                                        {subLandlordSelectBlock}
                                        {currentTenantSelectBlock}
                                    </div>
                                )}
                                {ownerSelectField}
                            </>
                        )}
                    </div>
                    {isContractLayout && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {subLandlordSelectBlock}
                            {currentTenantSelectBlock}
                        </div>
                    )}
                    </div>

                    {/* ===== RENT OUT FORM (收租) — 收租記錄 ===== */}
                    {formData.type === 'rent_out' && (
                        <>
                            <div className="border-t border-zinc-200 dark:border-white/10 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-4">收租記錄</h3>
                            </div>

                            <div className="space-y-4">
                                {renderCollectionContractRefField()}
                                <div className="space-y-2">
                                    <label className={labelClass}>租客名稱 *</label>
                                    <input
                                        type="text"
                                        name="rentCollectionTenantName"
                                        value={formData.rentCollectionTenantName}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                        placeholder={formData.rentOutTenantId ? '已自動填入現時租客' : '與收據一致之名稱'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>租賃性質</label>
                                    <select
                                        name="rentCollectionContractNature"
                                        value={formData.rentCollectionContractNature ?? ''}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇</option>
                                        {CONTRACT_NATURE_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value} className="bg-white dark:bg-[#1a1a2e]">
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
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
                                            const v = e.target.value as '' | RentCollectionPaymentMethod;
                                            setFormData(prev => ({
                                                ...prev,
                                                rentCollectionPaymentMethod: v,
                                                // 選現金或空白時，清空支票/FPS 影像等資料
                                                ...(v === '' || v === 'cash'
                                                    ? { rentCollectionChequeBank: '', rentCollectionChequeNumber: '', rentCollectionChequeImage: '' }
                                                    : {}),
                                                ...(v !== 'bank_in' ? { rentCollectionBankInImage: '' } : {}),
                                                ...(v === 'cheque' || v === '' ? { rentCollectionReceiptNumber: '' } : {}),
                                            }));
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="">請選擇</option>
                                        <option value="cash" className="bg-white dark:bg-[#1a1a2e]">現金</option>
                                        <option value="cheque" className="bg-white dark:bg-[#1a1a2e]">支票</option>
                                        <option value="fps" className="bg-white dark:bg-[#1a1a2e]">FPS轉帳</option>
                                        <option value="bank_in" className="bg-white dark:bg-[#1a1a2e]">入數</option>
                                    </select>
                                </div>
                            </div>
                            {/* 支票資料 — 僅選支票時顯示（避免與現金／FPS 等區塊同時出現多個「付款日期」欄位） */}
                            {formData.rentCollectionPaymentMethod === 'cheque' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>支票資料</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className={labelClass}>銀行</label>
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
                                            <label className={labelClass}>支票號碼</label>
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
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
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
                            {/* FPS 轉帳 — 僅選 FPS 時顯示 */}
                            {formData.rentCollectionPaymentMethod === 'fps' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>FPS 轉帳</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderRentCollectionReceiptField()}
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
                            {/* 現金 — 付款日期 */}
                            {formData.rentCollectionPaymentMethod === 'cash' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>現金資料</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderRentCollectionReceiptField()}
                                </div>
                            )}
                            {/* 入數資料 — 選入數時顯示 */}
                            {formData.rentCollectionPaymentMethod === 'bank_in' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>入數資料</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderRentCollectionReceiptField()}
                                    <div className="space-y-2">
                                        <label className={labelClass}>入數憑證／截圖（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                                                上載圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={onBankInImageChange} />
                                            </label>
                                            {formData.rentCollectionBankInImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, rentCollectionBankInImage: '' }))}
                                                        className="text-sm text-red-500 hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                    <img
                                                        src={formData.rentCollectionBankInImage}
                                                        alt="入數憑證預覽"
                                                        className="h-20 rounded-lg border border-zinc-200 dark:border-white/10 object-contain"
                                                    />
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
                                    <label className={labelClass}>承租人</label>
                                    <div className="flex gap-2 items-center flex-nowrap">
                                        <select
                                            name="proprietorId"
                                            value={formData.proprietorId}
                                            onChange={handleChange}
                                            className={`${inputClass} flex-1 min-w-0 w-auto`}
                                        >
                                            <option value="" className="bg-white dark:bg-[#1a1a2e]">
                                                請選擇承租人
                                            </option>
                                            {fullPickIndividuals.length > 0 && (
                                                <optgroup label="個人">
                                                    {fullPickIndividuals.map((p) => (
                                                        <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">
                                                            {p.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            {fullPickCompanies.length > 0 && (
                                                <optgroup label="公司">
                                                    {fullPickCompanies.map((p) => (
                                                        <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">
                                                            {p.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                        {formData.proprietorId ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const p = proprietors.find((pt) => pt.id === formData.proprietorId);
                                                    if (p) {
                                                        setProprietorModalInitial(p);
                                                        setRentingProprietorPickTarget('lessee');
                                                        setShowProprietorModal(true);
                                                    }
                                                }}
                                                className="p-2 text-zinc-400 hover:text-blue-500 rounded-lg shrink-0"
                                                title="編輯"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                    />
                                                </svg>
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setProprietorModalInitial(null);
                                                setRentingProprietorPickTarget('lessee');
                                                setShowProprietorModal(true);
                                            }}
                                            className="px-4 py-2 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/30 border border-blue-100 dark:border-blue-500/30 text-sm font-medium transition-all duration-300 h-11 whitespace-nowrap shrink-0"
                                        >
                                            + 新增
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-400 dark:text-white/40">
                                        交租方（承租人／付款主體），與上方「業主」區分；可含承租人代碼名冊
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>業主名稱 *</label>
                                    <input
                                        type="text"
                                        name="rentCollectionTenantName"
                                        value={formData.rentCollectionTenantName}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                        placeholder={formData.tenantId ? '已自動填入業主名稱' : '與收據一致之名稱'}
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
                                            const v = e.target.value as '' | RentCollectionPaymentMethod;
                                            setFormData(prev => ({
                                                ...prev,
                                                rentCollectionPaymentMethod: v,
                                                // 選現金或空白時，清空支票/FPS 影像等資料
                                                ...(v === '' || v === 'cash'
                                                    ? { rentCollectionChequeBank: '', rentCollectionChequeNumber: '', rentCollectionChequeImage: '' }
                                                    : {}),
                                                ...(v !== 'bank_in' ? { rentCollectionBankInImage: '' } : {}),
                                                ...(v === 'cheque' || v === '' ? { rentCollectionReceiptNumber: '' } : {}),
                                            }));
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="">請選擇</option>
                                        <option value="cash" className="bg-white dark:bg-[#1a1a2e]">現金</option>
                                        <option value="cheque" className="bg-white dark:bg-[#1a1a2e]">支票</option>
                                        <option value="fps" className="bg-white dark:bg-[#1a1a2e]">FPS轉帳</option>
                                        <option value="bank_in" className="bg-white dark:bg-[#1a1a2e]">入數</option>
                                    </select>
                                </div>
                            </div>
                            {/* 支票資料 — 僅選支票時顯示（避免與現金／FPS 等區塊同時出現多個「付款日期」欄位） */}
                            {formData.rentCollectionPaymentMethod === 'cheque' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>支票資料</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className={labelClass}>銀行</label>
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
                                            <label className={labelClass}>支票號碼</label>
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
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
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
                            {/* FPS 轉帳 — 僅選 FPS 時顯示 */}
                            {formData.rentCollectionPaymentMethod === 'fps' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>FPS 轉帳</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderRentCollectionReceiptField()}
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
                            {/* 現金 — 付款日期 */}
                            {formData.rentCollectionPaymentMethod === 'cash' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>現金資料</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderRentCollectionReceiptField()}
                                </div>
                            )}
                            {/* 入數資料 — 選入數時顯示 */}
                            {formData.rentCollectionPaymentMethod === 'bank_in' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>入數資料</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentCollectionPaymentDate"
                                            value={formData.rentCollectionPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderRentCollectionReceiptField()}
                                    <div className="space-y-2">
                                        <label className={labelClass}>入數憑證／截圖（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                                                上載圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={onBankInImageChange} />
                                            </label>
                                            {formData.rentCollectionBankInImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, rentCollectionBankInImage: '' }))}
                                                        className="text-sm text-red-500 hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                    <img
                                                        src={formData.rentCollectionBankInImage}
                                                        alt="入數憑證預覽"
                                                        className="h-20 rounded-lg border border-zinc-200 dark:border-white/10 object-contain"
                                                    />
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
                            <div className="border-t border-zinc-200 dark:border-white/10 pt-4 mt-4 space-y-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                                    <span className="text-sm font-medium text-zinc-700 dark:text-white/80 shrink-0">合約資料</span>
                                    <div
                                        className="flex gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-zinc-100/90 dark:bg-white/10 ring-1 ring-zinc-200/80 dark:ring-white/10 w-full sm:w-auto justify-stretch sm:justify-end"
                                        role="tablist"
                                        aria-label="合約資料類型"
                                    >
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={contractLabelMode === 'rent_out'}
                                            onClick={() =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    rentOutStatus:
                                                        prev.rentOutStatus === 'leasing_in' ? 'listing' : prev.rentOutStatus,
                                                }))
                                            }
                                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                                contractLabelMode === 'rent_out'
                                                    ? 'bg-white dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 shadow-md ring-1 ring-amber-400/35'
                                                    : 'text-zinc-500 dark:text-white/50 hover:text-amber-700 dark:hover:text-amber-300/90'
                                            }`}
                                        >
                                            出租
                                        </button>
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={contractLabelMode === 'lease_in'}
                                            onClick={() =>
                                                setFormData((prev) => ({ ...prev, rentOutStatus: 'leasing_in' }))
                                            }
                                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                                contractLabelMode === 'lease_in'
                                                    ? 'bg-white dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200 shadow-md ring-1 ring-cyan-400/40'
                                                    : 'text-zinc-500 dark:text-white/50 hover:text-cyan-700 dark:hover:text-cyan-300/90'
                                            }`}
                                        >
                                            租賃
                                        </button>
                                    </div>
                                </div>
                                <h3 className={`text-sm font-semibold ${contractSectionTitleClass}`}>
                                    {contractSectionPrefix}合約資料
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>{contractSectionPrefix}合約號碼 *</label>
                                    <input type="text" name="rentOutTenancyNumber" value={formData.rentOutTenancyNumber} onChange={handleChange} required className={inputClass} placeholder="RO-001" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>{contractSectionPrefix}合約放盤價</label>
                                    <input type="text" name="rentOutPricing" value={formatNumberWithCommas(formData.rentOutPricing)} onChange={(e) => handlePriceChange('rentOutPricing', e.target.value)} className={inputClass} placeholder="0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>{contractSectionPrefix}合約月租 *</label>
                                    <input type="text" name="rentOutMonthlyRental" value={formatNumberWithCommas(formData.rentOutMonthlyRental)} onChange={(e) => handlePriceChange('rentOutMonthlyRental', e.target.value)} required className={inputClass} placeholder="50,000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>{contractSectionPrefix}合約期數 (月)</label>
                                    <input type="number" name="rentOutPeriods" value={formData.rentOutPeriods} onChange={handleChange} className={inputClass} placeholder="12" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>{contractSectionPrefix}合約總額</label>
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
                                    <label className={labelClass}>{contractSectionPrefix}合約開始日期</label>
                                    <input type="date" name="rentOutStartDate" value={formData.rentOutStartDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>{contractSectionPrefix}合約結束日期</label>
                                    <input type="date" name="rentOutEndDate" value={formData.rentOutEndDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>合約性質</label>
                                <select
                                    name="rentOutContractNature"
                                    value={formData.rentOutContractNature ?? ''}
                                    onChange={handleChange}
                                    className={inputClass}
                                >
                                    <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇</option>
                                    {CONTRACT_NATURE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value} className="bg-white dark:bg-[#1a1a2e]">
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約按金</label>
                                    <input
                                        type="text"
                                        name="rentOutDepositReceived"
                                        value={formatNumberWithCommas(formData.rentOutDepositReceived)}
                                        onChange={(e) => handlePriceChange('rentOutDepositReceived', e.target.value)}
                                        className={inputClass}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>按金支付方式</label>
                                    <select
                                        name="rentOutDepositPaymentMethod"
                                        value={formData.rentOutDepositPaymentMethod}
                                        onChange={(e) => {
                                            const v = e.target.value as '' | RentCollectionPaymentMethod;
                                            setFormData((prev) => ({
                                                ...prev,
                                                rentOutDepositPaymentMethod: v,
                                                ...(v === '' || v === 'cash'
                                                    ? {
                                                          rentOutDepositChequeBank: '',
                                                          rentOutDepositChequeNumber: '',
                                                          rentOutDepositChequeImage: '',
                                                      }
                                                    : {}),
                                                ...(v !== 'bank_in' ? { rentOutDepositBankInImage: '' } : {}),
                                                ...(v === 'cheque' || v === '' ? { rentOutDepositReceiptNumber: '' } : {}),
                                            }));
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="" className="bg-white dark:bg-[#1a1a2e]">請選擇</option>
                                        <option value="cash" className="bg-white dark:bg-[#1a1a2e]">現金</option>
                                        <option value="cheque" className="bg-white dark:bg-[#1a1a2e]">支票</option>
                                        <option value="fps" className="bg-white dark:bg-[#1a1a2e]">FPS轉帳</option>
                                        <option value="bank_in" className="bg-white dark:bg-[#1a1a2e]">入數</option>
                                    </select>
                                </div>
                            </div>

                            {formData.rentOutDepositPaymentMethod === 'cheque' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>支票資料</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className={labelClass}>銀行</label>
                                            <input
                                                type="text"
                                                name="rentOutDepositChequeBank"
                                                value={formData.rentOutDepositChequeBank}
                                                onChange={handleChange}
                                                className={inputClass}
                                                placeholder="例如：匯豐銀行"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>支票號碼</label>
                                            <input
                                                type="text"
                                                name="rentOutDepositChequeNumber"
                                                value={formData.rentOutDepositChequeNumber}
                                                onChange={handleChange}
                                                className={inputClass}
                                                placeholder="支票號碼"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentOutDepositPaymentDate"
                                            value={formData.rentOutDepositPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>支票影像（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                                                上載圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={onDepositChequeImageChange} />
                                            </label>
                                            {formData.rentOutDepositChequeImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData((prev) => ({ ...prev, rentOutDepositChequeImage: '' }))}
                                                        className="text-sm text-red-500 hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                    <img
                                                        src={formData.rentOutDepositChequeImage}
                                                        alt="支票預覽"
                                                        className="h-20 rounded-lg border border-zinc-200 dark:border-white/10 object-contain"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {formData.rentOutDepositPaymentMethod === 'fps' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>FPS 轉帳</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentOutDepositPaymentDate"
                                            value={formData.rentOutDepositPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderContractDepositReceiptField()}
                                    <div className="space-y-2">
                                        <label className={labelClass}>轉帳證明／截圖（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                                                上載圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={onDepositChequeImageChange} />
                                            </label>
                                            {formData.rentOutDepositChequeImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData((prev) => ({ ...prev, rentOutDepositChequeImage: '' }))}
                                                        className="text-sm text-red-500 hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                    <img
                                                        src={formData.rentOutDepositChequeImage}
                                                        alt="轉帳證明預覽"
                                                        className="h-20 rounded-lg border border-zinc-200 dark:border-white/10 object-contain"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {formData.rentOutDepositPaymentMethod === 'cash' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>現金資料</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentOutDepositPaymentDate"
                                            value={formData.rentOutDepositPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderContractDepositReceiptField()}
                                </div>
                            )}
                            {formData.rentOutDepositPaymentMethod === 'bank_in' && (
                                <div className={rentPaymentDetailBoxClass}>
                                    <p className={rentPaymentDetailTitleClass}>入數資料</p>
                                    <div className="space-y-2">
                                        <label className={labelClass}>付款日期</label>
                                        <input
                                            type="date"
                                            name="rentOutDepositPaymentDate"
                                            value={formData.rentOutDepositPaymentDate}
                                            onChange={handleChange}
                                            className={inputClass}
                                        />
                                    </div>
                                    {renderContractDepositReceiptField()}
                                    <div className="space-y-2">
                                        <label className={labelClass}>入數憑證／截圖（選填）</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="px-4 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                                                上載圖片
                                                <input type="file" accept="image/*" className="hidden" onChange={onDepositBankInImageChange} />
                                            </label>
                                            {formData.rentOutDepositBankInImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData((prev) => ({ ...prev, rentOutDepositBankInImage: '' }))}
                                                        className="text-sm text-red-500 hover:underline"
                                                    >
                                                        移除
                                                    </button>
                                                    <img
                                                        src={formData.rentOutDepositBankInImage}
                                                        alt="入數憑證預覽"
                                                        className="h-20 rounded-lg border border-zinc-200 dark:border-white/10 object-contain"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>{contractSectionPrefix}按金收取日期</label>
                                    <input type="date" name="rentOutDepositReceiveDate" value={formData.rentOutDepositReceiveDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>{contractSectionPrefix}按金退回日期</label>
                                    <input type="date" name="rentOutDepositReturnDate" value={formData.rentOutDepositReturnDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>{contractSectionPrefix}按金退回金額</label>
                                <input type="text" name="rentOutDepositReturnAmount" value={formatNumberWithCommas(formData.rentOutDepositReturnAmount)} onChange={(e) => handlePriceChange('rentOutDepositReturnAmount', e.target.value)} className={inputClass} placeholder="100,000" />
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>{contractSectionPrefix}合約租務狀態</label>
                                <select name="rentOutStatus" value={formData.rentOutStatus} onChange={handleChange} className={inputClass}>
                                    {RENT_OUT_CONTRACT_STATUS_OPTIONS.map(s => (
                                        <option key={s.value} value={s.value} className="bg-white dark:bg-[#1a1a2e]">{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>{contractSectionPrefix}合約描述</label>
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
                <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
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
                    initialData={proprietorModalInitial}
                    initialEditing={proprietorModalInitial ? true : undefined}
                    propertyCode={
                        formData.propertyId ? properties.find((p) => p.id === formData.propertyId)?.code : undefined
                    }
                    onClose={() => {
                        setShowProprietorModal(false);
                        setProprietorModalInitial(null);
                    }}
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
                    currentPropertyCode={formData.propertyId ? properties.find(p => p.id === formData.propertyId)?.code : undefined}
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
            {/* Current Tenant Detail Modal */}
            {showCurrentTenantDetail && (
                <CurrentTenantDetailModal
                    currentTenant={showCurrentTenantDetail}
                    onClose={() => setShowCurrentTenantDetail(null)}
                    onEdit={() => {
                        setEditCurrentTenant(showCurrentTenantDetail);
                        setShowCurrentTenantDetail(null);
                        setShowCurrentTenantModal(true);
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

    const statusLabel =
        subLandlord.status === 'listing' ? '放盤中' :
        subLandlord.status === 'renting' ? '出租中' :
        subLandlord.status === 'leasing_in' ? '租入中' :
        subLandlord.status === 'completed' ? '已完租' : '—';

    const isExpired = subLandlord.endDate ? new Date(subLandlord.endDate) < new Date() : false;

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 min-h-screen bg-black/60 backdrop-blur-sm z-70"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 m-auto h-fit max-h-[90vh] overflow-y-auto w-full max-w-3xl flex flex-col bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-70"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">二房東詳細資料</h2>
                            <p className="text-sm text-zinc-500 dark:text-white/50">{subLandlord.name}</p>
                        </div>
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

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* 基本資料 */}
                    <section>
                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">基本資料</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">名稱</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-white">{subLandlord.name}</p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租號碼</p>
                                <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">{subLandlord.tenancyNumber || '—'}</p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">狀態</p>
                                <p className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                                    {isExpired ? '已過期' : statusLabel}
                                </p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租人</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{subLandlord.lessor || '—'}</p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">出租月租</p>
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                    {subLandlord.monthlyRental ? `$${formatNumber(subLandlord.monthlyRental)}` : '—'}
                                </p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">期數</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {subLandlord.periods ? `${subLandlord.periods} 個月` : '—'}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 日期資料 */}
                    <section>
                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">日期資料</h3>
                        <div className="bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 divide-y divide-zinc-100 dark:divide-white/5">
                            <div className="flex items-center gap-3 px-4 py-3">
                                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">開始日期</span>
                                <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(subLandlord.startDate)}</span>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-3">
                                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">結束日期</span>
                                <span className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-zinc-800 dark:text-white'}`}>
                                    {formatDate(subLandlord.endDate)}
                                    {isExpired && <span className="ml-2 text-xs font-medium">(已過期)</span>}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-3">
                                <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">實際結束</span>
                                <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(subLandlord.actualEndDate)}</span>
                            </div>
                        </div>
                    </section>

                    {/* 按金資料 */}
                    {(subLandlord.depositReceived != null || subLandlord.depositReceiptNumber) && (
                        <section>
                            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">按金資料</h3>
                            <div className="bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 divide-y divide-zinc-100 dark:divide-white/5">
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">按金</span>
                                    <span className="text-sm font-medium text-zinc-800 dark:text-white">
                                        {subLandlord.depositReceived != null ? `$${formatNumber(subLandlord.depositReceived)}` : '—'}
                                    </span>
                                </div>
                                {subLandlord.depositReceiptNumber && (
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">收據號碼</span>
                                        <span className="text-sm font-mono font-medium text-zinc-800 dark:text-white">{subLandlord.depositReceiptNumber}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">收取日期</span>
                                    <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(subLandlord.depositReceiveDate)}</span>
                                </div>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span className="text-xs text-zinc-500 dark:text-white/50 w-20 shrink-0">退回日期</span>
                                    <span className="text-sm font-medium text-zinc-800 dark:text-white">{formatDate(subLandlord.depositReturnDate)}</span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 關聯物業 */}
                    <section>
                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">
                            關聯物業 ({relatedProperties.length})
                        </h3>
                        {relatedProperties.length === 0 ? (
                            <div className="p-6 text-center bg-zinc-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-white/10">
                                <Building2 className="w-8 h-8 text-zinc-300 dark:text-white/10 mx-auto mb-2" />
                                <p className="text-sm text-zinc-500 dark:text-white/40">暫無關聯物業</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {relatedProperties.map(property => (
                                    <div
                                        key={property.id}
                                        className="p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{property.name}</span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-mono font-medium">
                                                        {property.code}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <span className="text-xs text-zinc-500 dark:text-white/50 truncate">{property.address || '—'}</span>
                                                </div>
                                            </div>
                                            {property.address && (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 text-zinc-400 dark:text-white/40 hover:text-purple-500 dark:hover:text-purple-400 transition-colors shrink-0"
                                                    title="在 Google Maps 開啟"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 描述 */}
                    {subLandlord.description && (
                        <section>
                            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">描述</h3>
                            <div
                                className="text-sm text-zinc-700 dark:text-white/80 prose dark:prose-invert max-w-none p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5"
                                dangerouslySetInnerHTML={{ __html: subLandlord.description }}
                            />
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-zinc-100 dark:border-white/5 shrink-0 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl hover:bg-zinc-200 dark:hover:bg-white/20 text-sm font-medium transition-all"
                    >
                        關閉
                    </button>
                </div>
            </motion.div>
        </>
    );
}
