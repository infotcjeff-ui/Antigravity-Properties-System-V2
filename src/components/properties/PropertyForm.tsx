'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useProperties, useProprietorsQuery, useRents, useRentsQuery, useRentsWithRelationsQuery, useUsersQuery } from '@/hooks/useStorage';
import { fileToBase64, validateImageUpload, compressImage } from '@/lib/imageUtils';
import type { Property, Proprietor, Rent } from '@/lib/db';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import ProprietorModal from '@/components/properties/ProprietorModal';
import RentModal from '@/components/properties/RentModal';
import RichTextEditor from '@/components/common/RichTextEditor';
import AnimatedSelect from '@/components/ui/AnimatedSelect';
import AnimatedMultiSelect from '@/components/ui/AnimatedMultiSelect';
import { FileUpload } from '@/components/ui/file-upload';
import LocationPickerMap from '@/components/properties/LocationPickerMapDynamic';
import {
    dedupeRecordsByDisplayName,
    formatLotAreaForInput,
    parseLotAreaInput,
    parseLotEntries as parseLotEntriesFromStr,
    proprietorCategoryLabelZh,
} from '@/lib/formatters';
import { normalizePropertyLocation } from '@/lib/propertyLocation';
import {
    compareRentOutForListNewestFirst,
    formatDateDMY,
    getRentCollectionPayListStatus,
    getRentOutCollectionDisplayPeriod,
    getRentOutOrContractListNumber,
} from '@/lib/rentPaymentDisplay';

/** 由物業資料建立表單狀態；地址欄優先使用 address 欄，否則沿用 location 內文字 */
function formStateFromProperty(p: Property | null | undefined) {
    const loc = normalizePropertyLocation(p?.location);
    const addressFromLoc = loc?.address?.trim() || '';
    const address = (p?.address?.trim() || addressFromLoc || '').trim();
    return {
        name: p?.name || '',
        code: p?.code || '',
        address,
        lotIndex: p?.lotIndex || '',
        lotArea: p?.lotArea || '',
        type: p?.type || 'group_asset',
        status: p?.status || 'holding',
        landUse: p?.landUse ? p.landUse.split(',') : [],
        proprietorId: p?.proprietorId || '',
        proprietorIds: p?.proprietorIds || (p?.proprietorId ? [p.proprietorId] : []),
        tenantId: p?.tenantId || '',
        googleDrivePlanUrl: p?.googleDrivePlanUrl || '',
        hasPlanningPermission: p?.hasPlanningPermission || '',
        location: loc,
        images: p?.images || [],
        geoMaps: p?.geoMaps || [],
        notes: p?.notes || '',
        createdBy: p?.createdBy || '',
    };
}

interface PropertyFormProps {
    property?: Property | null;
    onClose: () => void;
    onSuccess: () => void;
}

const propertyTypes = [
    { value: 'group_asset', label: '集團資產' },
    { value: 'co_investment', label: '合作投資' },
    { value: 'external_lease', label: '外租物業' },
    { value: 'managed_asset', label: '代管資產' },
];

const propertyStatuses = [
    { value: 'holding', label: '持有中' },
    { value: 'renting', label: '出租中' },
    { value: 'sold', label: '已售出' },
    { value: 'suspended', label: '已暫停' },
];

const landUseTypes = [
    { value: 'agr', label: 'AGR 農業' },
    { value: 'ca', label: 'CA 自然保育區' },
    { value: 'os', label: 'OS 露天貯物' },
    { value: 'v', label: 'V 鄉村式發展' },
    { value: 'ou', label: 'OU 其他指定用途' },
];

export default function PropertyForm({ property, onClose, onSuccess }: PropertyFormProps) {
    const queryClient = useQueryClient();
    const { addProperty, updateProperty, error: propertiesError } = useProperties();
    const { data: proprietors, isLoading: propsLoading } = useProprietorsQuery();
    const { data: allRents, isLoading: rentsLoading } = useRentsQuery();
    /** 合約記錄需 join tenant（業主）與 current_tenants（現時租客），與管理合約頁一致 */
    const { data: allContractsWithRelations = [] } = useRentsWithRelationsQuery({ type: 'contract' });
    const { updateRent, deleteRent } = useRents();
    const { addNotification } = useNotifications();
    const { isAuthenticated, user: currentUser } = useAuth();
    const { data: users, isLoading: usersLoading } = useUsersQuery();
    const isAdmin = currentUser?.role === 'admin';

    const [editingRent, setEditingRent] = useState<Rent | null>(null);
    const [unlinkingRentId, setUnlinkingRentId] = useState<string | null>(null);

    const [showProprietorModal, setShowProprietorModal] = useState(false);
    const [showRentModal, setShowRentModal] = useState(false);
    const [showContractModal, setShowContractModal] = useState(false);
    const [showLotAddModal, setShowLotAddModal] = useState(false);
    const [lotAddMode, setLotAddMode] = useState<'new' | 'old' | null>(null);
    const [tempLotInput, setTempLotInput] = useState('');
    const [editingLotIndex, setEditingLotIndex] = useState<number | null>(null);
    const [editingLotValue, setEditingLotValue] = useState('');
    const [editingLotType, setEditingLotType] = useState<'new' | 'old'>('new');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [proprietorModalMode, setProprietorModalMode] = useState<'proprietor' | 'tenant'>('proprietor');
    const [isMapSearching, setIsMapSearching] = useState(false);
    const [pendingProprietors, setPendingProprietors] = useState<Record<string, Partial<Proprietor>>>({});
    /** 非 null 時為「編輯業主」；null 為新增業主 */
    const [proprietorModalInitial, setProprietorModalInitial] = useState<Proprietor | null>(null);

    // Form state（編輯時由 formStateFromProperty 帶入，並正規化 location）
    const [formData, setFormData] = useState(() => formStateFromProperty(property));

    // Unified ordered list: string = URL, object = pending upload
    const [orderedImages, setOrderedImages] = useState<(string | { file: File; preview: string })[]>([]);
    const [orderedGeoMaps, setOrderedGeoMaps] = useState<(string | { file: File; preview: string })[]>([]);

    const proprietorsList = useMemo(() => {
        const owners = (proprietors || []).filter(p => !p.code?.startsWith('T'));
        return dedupeRecordsByDisplayName(owners);
    }, [proprietors]);
    const tenantsList = useMemo(() => (proprietors || []).filter(p => p.code?.startsWith('T')), [proprietors]);

    const serializeLotEntries = (entries: { type: 'new' | 'old'; value: string }[]): string =>
        entries.map(e => `${e.type === 'new' ? '新' : '舊'}:${e.value}`).join('\n');

    const lotEntries = useMemo(() => parseLotEntriesFromStr(formData.lotIndex), [formData.lotIndex]);

    const appendToLotIndex = (newLot: string, mode: 'new' | 'old') => {
        const trimmed = newLot.trim();
        if (!trimmed) return;
        const entry = { type: mode, value: trimmed };
        setFormData(prev => ({
            ...prev,
            lotIndex: serializeLotEntries([...lotEntries, entry]),
        }));
        setShowLotAddModal(false);
        setLotAddMode(null);
        setTempLotInput('');
    };

    const removeLotEntry = (index: number) => {
        const next = lotEntries.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, lotIndex: serializeLotEntries(next) }));
    };

    const startEditLotEntry = (index: number) => {
        const entry = lotEntries[index];
        if (entry) {
            setEditingLotIndex(index);
            setEditingLotValue(entry.value);
        }
    };

    const saveEditLotEntry = () => {
        if (editingLotIndex === null || !editingLotValue.trim()) return;
        const next = [...lotEntries];
        next[editingLotIndex] = { type: editingLotType, value: editingLotValue.trim() };
        setFormData(prev => ({ ...prev, lotIndex: serializeLotEntries(next) }));
        setEditingLotIndex(null);
        setEditingLotValue('');
    };

    const cancelEditLotEntry = () => {
        setEditingLotIndex(null);
        setEditingLotValue('');
    };

    const rents = useMemo(() => {
        if (!property?.id || !allRents) return [];
        return allRents.filter(r => r.propertyId === property.id)
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }, [property?.id, allRents]);

    const rentOutRents = useMemo(
        () => [...rents.filter((r) => r.type === 'rent_out')].sort(compareRentOutForListNewestFirst).reverse(),
        [rents],
    );
    const rentingRents = useMemo(() => rents.filter(r => r.type === 'renting'), [rents]);
    const contractRents = useMemo(() => {
        if (!property?.id) return [];
        return (allContractsWithRelations as any[])
            .filter((r) => r.propertyId === property.id)
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }, [property?.id, allContractsWithRelations]);
    /** 與 dashboard/contracts 一致：leasing_in 為租賃合約，其餘為出租合約 */
    const leaseOutContractRents = useMemo(
        () => contractRents.filter((c: any) => (c.rentOutStatus || c.status) !== 'leasing_in'),
        [contractRents],
    );
    const leaseInContractRents = useMemo(
        () => contractRents.filter((c: any) => (c.rentOutStatus || c.status) === 'leasing_in'),
        [contractRents],
    );
    const latestContract = useMemo(() => contractRents[0], [contractRents]);
    const hasContractRecord = contractRents.length > 0;
    const contractOwnerId = latestContract?.tenantId || '';
    const contractSubLandlordId = (latestContract as any)?.rentOutSubLandlordId || '';
    const contractCurrentTenantId = latestContract?.rentOutTenantIds?.[0] || '';

    /** 收租表第二欄為現時租客；交租表第二、三欄為業主（tenant_id）、承租人（proprietor_id） */
    const renderRentTable = (records: Rent[], partyMode: 'lessee' | 'landlord' | 'owner' | 'simple' = 'lessee') => {
        if (records.length === 0) {
            return (
                <div className="p-6 bg-zinc-50 dark:bg-white/5 rounded-xl text-center text-zinc-600 dark:text-white/60 text-base">
                    尚未有相關記錄
                </div>
            );
        }

        const rentGridClass =
            partyMode === 'simple'
                ? 'grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_90px] gap-4 px-4'
                : partyMode === 'owner'
                  ? 'grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_90px] gap-4 px-4'
                  : partyMode === 'landlord'
                    ? 'grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_90px] gap-4 px-4'
                    : 'grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(76px,0.95fr)_minmax(0,1fr)_90px] gap-4 px-4';
        /** 交租記錄「編號」欄：顯示所屬物業編號（與表單「編號」一致） */
        const propertyCodeForRentingRows = (formData.code || property?.code || '').trim() || '-';

        return (
            <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                <div
                    className={`${rentGridClass} py-3 bg-zinc-100/80 dark:bg-white/5 text-sm font-semibold text-zinc-700 dark:text-white/80 uppercase tracking-wider border-b border-zinc-200 dark:border-white/10`}
                >
                    <div className="flex items-center gap-1.5 font-bold">編號</div>
                    {partyMode === 'owner' ? (
                        <>
                            <div className="font-bold">業主</div>
                            <div className="font-bold">承租人</div>
                        </>
                    ) : partyMode === 'landlord' ? (
                        <>
                            <div className="font-bold">業主</div>
                            <div className="font-bold">現時租客</div>
                        </>
                    ) : partyMode === 'simple' ? (
                        <div className="font-bold">業主</div>
                    ) : (
                        <div className="font-bold">承租人</div>
                    )}
                    <div className="font-bold">{partyMode === 'simple' || partyMode === 'landlord' ? '租期' : '地點'}</div>
                    {partyMode !== 'simple' && partyMode !== 'landlord' && partyMode !== 'owner' && (
                        <div className="font-bold">租期</div>
                    )}
                    <div className="font-bold">繳付狀態</div>
                    <div className="text-center font-bold">操作</div>
                </div>
                {records.map((rent) => {
                    const otherPartyLessee =
                        rent.tenant || rent.proprietor || (proprietors || []).find(p => p.id === (rent.tenantId || rent.proprietorId));
                    /** 收租：本期以簡化表單 end_date／rent_collection_date 為準；合約列仍用 rent_out_* */
                    let startDate: Date | null = null;
                    let endDate: Date | null = null;
                    if (rent.type === 'rent_out') {
                        const p = getRentOutCollectionDisplayPeriod(rent as Rent);
                        startDate = p.start;
                        endDate = p.end;
                    } else if (rent.type === 'contract') {
                        startDate = rent.rentOutStartDate
                            ? new Date(rent.rentOutStartDate)
                            : rent.startDate
                              ? new Date(rent.startDate)
                              : (rent as any).rentCollectionDate
                                ? new Date((rent as any).rentCollectionDate)
                                : null;
                        endDate = rent.rentOutEndDate
                            ? new Date(rent.rentOutEndDate)
                            : rent.endDate
                              ? new Date(rent.endDate)
                              : null;
                    } else {
                        startDate = rent.rentingStartDate
                            ? new Date(rent.rentingStartDate)
                            : rent.startDate
                              ? new Date(rent.startDate)
                              : null;
                        endDate = rent.rentingEndDate
                            ? new Date(rent.rentingEndDate)
                            : rent.endDate
                              ? new Date(rent.endDate)
                              : null;
                    }
                    const monthlyRent = rent.type === 'rent_out' || rent.type === 'contract'
                        ? (rent.rentOutMonthlyRental || rent.amount || 0)
                        : (rent.rentingMonthlyRental || rent.amount || 0);

                    const months = startDate && endDate
                        ? Math.max(
                              1,
                              Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
                          )
                        : (rent.type === 'rent_out' || rent.type === 'contract' ? rent.rentOutPeriods : rent.rentingPeriods) || 0;

                    const contractNumber =
                        rent.type === 'rent_out' || rent.type === 'contract'
                            ? getRentOutOrContractListNumber(rent as Rent)
                            : propertyCodeForRentingRows;

                    /** 交租業主存於 tenant_id；承租人存於 proprietor_id（與 RentModal 一致） */
                    const rentingOwnerParty =
                        rent.type === 'renting'
                            ? rent.tenant || (proprietors || []).find((p) => p.id === rent.tenantId)
                            : undefined;
                    const rentingLesseeParty =
                        rent.type === 'renting'
                            ? rent.proprietor || (proprietors || []).find((p) => p.id === rent.proprietorId)
                            : undefined;

                    const rentOutCurrentTenantLabel = (() => {
                        const rcName = (rent as any).rentCollectionTenantName;
                        if (rcName != null && String(rcName).trim()) return String(rcName).trim();
                        const rt = (rent as any).rentOutTenants;
                        if (Array.isArray(rt) && rt.length > 0) {
                            const joined = rt.map((x: unknown) => String(x).trim()).filter(Boolean).join('、');
                            if (joined) return joined;
                        }
                        return '';
                    })();

                    const rentOutOwnerParty =
                        rent.type === 'rent_out' || rent.type === 'contract'
                            ? rent.proprietor ||
                              (proprietors || []).find((p) => p.id === rent.proprietorId) ||
                              (formData.proprietorId
                                  ? (proprietors || []).find((p) => p.id === formData.proprietorId)
                                  : undefined) ||
                              (formData.proprietorIds?.length
                                  ? (proprietors || []).find((p) => p.id === formData.proprietorIds[0])
                                  : undefined)
                            : undefined;

                    const payStatus =
                        rent.type === 'rent_out' || rent.type === 'renting'
                            ? getRentCollectionPayListStatus(rent as any)
                            : null;

                    return (
                        <div
                            key={rent.id}
                            className={`${rentGridClass} py-4 border-b border-zinc-100 dark:border-white/5 text-sm hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors items-center last:border-0 group`}
                        >
                            <div className="flex flex-col gap-1">
                                <span className="font-mono text-xs font-bold text-zinc-600 dark:text-white/70 tracking-tight">{contractNumber}</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full w-fit font-bold tracking-wider ${rent.type === 'rent_out'
                                        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20'
                                        : rent.type === 'contract'
                                        ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20'
                                        : 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20'}`}>
                                        {rent.type === 'rent_out' ? '收租' : rent.type === 'contract' ? '合約記錄' : '交租'}
                                    </span>
                                </div>
                            </div>
                            {partyMode === 'owner' ? (
                                <>
                                    <div className="flex flex-col overflow-hidden min-w-0">
                                        <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                            {rentingOwnerParty?.name || (rent.type === 'renting' ? '(暫缺)' : '-')}
                                        </span>
                                        {rentingOwnerParty?.shortName ? (
                                            <span className="text-xs text-zinc-500 dark:text-white/50 truncate uppercase">
                                                {rentingOwnerParty.shortName}
                                            </span>
                                        ) : null}
                                    </div>
                                    {/*
                                     * 任務1：交租 tab（partyMode='simple'）隱藏承租人欄
                                     */}
                                </>
                            ) : partyMode === 'landlord' ? (
                                <>
                                    <div className="flex flex-col overflow-hidden min-w-0">
                                        <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                            {rentOutOwnerParty?.name || '—'}
                                        </span>
                                        {rentOutOwnerParty?.shortName ? (
                                            <span className="text-xs text-zinc-500 dark:text-white/50 truncate uppercase">
                                                {rentOutOwnerParty.shortName}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="flex flex-col overflow-hidden min-w-0">
                                        <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                            {rentOutCurrentTenantLabel || '—'}
                                        </span>
                                    </div>
                                </>
                            ) : partyMode === 'simple' ? (
                                <div className="flex flex-col overflow-hidden min-w-0">
                                    <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                        {rentingOwnerParty?.name || (rent.type === 'renting' ? '(暫缺)' : '-')}
                                    </span>
                                    {rentingOwnerParty?.shortName ? (
                                        <span className="text-xs text-zinc-500 dark:text-white/50 truncate uppercase">
                                            {rentingOwnerParty.shortName}
                                        </span>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex flex-col overflow-hidden min-w-0">
                                    <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                        {rent.type === 'contract'
                                            ? (rent.rentOutLessor || otherPartyLessee?.name || '-')
                                            : (otherPartyLessee?.name || '-')}
                                    </span>
                                    {otherPartyLessee?.shortName && (
                                        <span className="text-xs text-zinc-500 dark:text-white/50 truncate uppercase">
                                            {otherPartyLessee.shortName}
                                        </span>
                                    )}
                                </div>
                            )}
                            {/*
                             * landlord/simple：該列顯示「租期」（日期+月數）
                             * owner/simple owner：該列顯示「地點」（位置名稱）
                             */}
                            {partyMode === 'simple' || partyMode === 'landlord' ? (
                                <div className="flex flex-col">
                                    {startDate ? (
                                        <>
                                            <div className="text-zinc-800 dark:text-white/90 font-medium tabular-nums text-sm">
                                                {startDate.toLocaleDateString('zh-TW')}
                                            </div>
                                            <div className="text-zinc-600 dark:text-white/60 flex items-center gap-1 tabular-nums text-xs">
                                                <span>~</span> {endDate ? endDate.toLocaleDateString('zh-TW') : '-'}
                                            </div>
                                            <div className="mt-1 flex items-center gap-1">
                                                <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-white/10 rounded font-semibold text-zinc-600 dark:text-white/60">
                                                    {months}個月
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-zinc-500 dark:text-white/40 italic text-sm">未設定</span>
                                    )}
                                </div>
                            ) : (
                                <div className="text-zinc-700 dark:text-white/80 text-sm leading-relaxed line-clamp-2">
                                    {rent.location || rent.rentOutAddressDetail || formData.name || '-'}
                                </div>
                            )}
                            {partyMode !== 'simple' && partyMode !== 'landlord' && partyMode !== 'owner' && (
                                <div className="flex flex-col">
                                    {startDate ? (
                                        <>
                                            <div className="text-zinc-800 dark:text-white/90 font-medium tabular-nums text-sm">
                                                {startDate.toLocaleDateString('zh-TW')}
                                            </div>
                                            <div className="text-zinc-600 dark:text-white/60 flex items-center gap-1 tabular-nums text-xs">
                                                <span>~</span> {endDate ? endDate.toLocaleDateString('zh-TW') : '-'}
                                            </div>
                                            <div className="mt-1 flex items-center gap-1">
                                                <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-white/10 rounded font-semibold text-zinc-600 dark:text-white/60">
                                                    {months}個月
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-zinc-500 dark:text-white/40 italic text-sm">未設定</span>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center min-w-0">
                                {payStatus === 'paid' ? (
                                    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300/60 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-500/40">
                                        已繳付
                                    </span>
                                ) : payStatus === 'unpaid' ? (
                                    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-white/10 dark:text-zinc-200 dark:border-white/15">
                                        未繳付
                                    </span>
                                ) : (
                                    <span className="text-zinc-400 dark:text-white/35 text-sm">—</span>
                                )}
                            </div>
                            {partyMode !== 'simple' && partyMode !== 'landlord' && partyMode !== 'owner' && (
                                <div className="text-right min-w-0">
                                    <span className="inline-block text-sm font-semibold text-zinc-900 dark:text-white tabular-nums whitespace-nowrap">
                                        ${monthlyRent.toLocaleString()}/月
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={() => setEditingRent(rent)}
                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all"
                                    title="更改租金記錄"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    disabled={unlinkingRentId === rent.id}
                                    onClick={() => handleUnlinkRent(rent.id!)}
                                    className={`p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-all ${unlinkingRentId === rent.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="取消物業連結"
                                >
                                    {unlinkingRentId === rent.id ? (
                                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    /** 與 dashboard/contracts 相同：合約業主為 tenant_id join（tenant），現時租客為 current_tenants */
    const contractOwnerDisplayName = (c: any) => {
        const fromJoin =
            (c.tenant?.name && String(c.tenant.name).trim()) ||
            (c.proprietor?.name && String(c.proprietor.name).trim());
        if (fromJoin) return fromJoin;
        const p = (proprietors || []).find((x) => x.id === c.tenantId);
        return (p?.name && String(p.name).trim()) || '';
    };
    const contractLesseeDisplayName = (c: any) => {
        const fromCt = c.currentTenant?.name && String(c.currentTenant.name).trim();
        if (fromCt) return fromCt;
        const rt = c.rentOutTenants;
        if (Array.isArray(rt) && rt[0] != null && String(rt[0]).trim()) return String(rt[0]).trim();
        return '';
    };

    /** 合約記錄：分出租（amber）／租賃（violet），欄位與管理合約頁一致 */
    const renderContractTable = (records: any[], variant: 'lease_out' | 'lease_in') => {
        const isLeaseIn = variant === 'lease_in';
        const shellClass = isLeaseIn
            ? 'border-violet-200 dark:border-violet-500/35'
            : 'border-amber-200 dark:border-amber-500/30';
        const headClass = isLeaseIn
            ? 'bg-violet-50/60 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/25'
            : 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30';
        const rowBorderHover = isLeaseIn
            ? 'border-violet-200/50 dark:border-violet-500/15 hover:bg-violet-50/50 dark:hover:bg-violet-500/8'
            : 'border-amber-200/50 dark:border-amber-500/10 hover:bg-amber-50/50 dark:hover:bg-amber-500/5';
        const badgeClass = isLeaseIn
            ? 'bg-violet-100 text-violet-900 border border-violet-400/70 dark:bg-violet-950/55 dark:text-violet-100 dark:border-violet-500/55'
            : 'bg-amber-100 text-amber-800 border border-amber-300/60 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/35';

        if (records.length === 0) {
            return (
                <div
                    className={`p-6 rounded-xl text-center text-base border ${shellClass} ${
                        isLeaseIn
                            ? 'text-violet-700/80 dark:text-violet-300/70 bg-violet-50/30 dark:bg-violet-500/5'
                            : 'text-amber-800/80 dark:text-amber-300/70 bg-amber-50/30 dark:bg-amber-500/5'
                    }`}
                >
                    尚未有相關記錄
                </div>
            );
        }

        return (
            <div className={`border rounded-xl overflow-hidden shadow-sm ${shellClass}`}>
                <div
                    className={`grid grid-cols-[100px_1fr_1fr_1.5fr_1.2fr_1fr_minmax(0,1fr)_90px] gap-4 px-4 py-3 text-sm font-semibold uppercase tracking-wider border-b ${headClass} text-zinc-700 dark:text-white/80`}
                >
                    <div className="flex items-center gap-1.5 font-bold">編號</div>
                    <div className="font-bold">業主</div>
                    <div className="font-bold">現時租客</div>
                    <div className="font-bold">租借位置</div>
                    <div className="font-bold">租期</div>
                    <div className="text-right font-bold">租金/月</div>
                    <div className="font-bold">{isLeaseIn ? '已付按金' : '已收按金'}</div>
                    <div className="text-center font-bold">操作</div>
                </div>
                {records.map((rent) => {
                    const startDate = rent.rentOutStartDate ? new Date(rent.rentOutStartDate) : null;
                    const endDate = rent.rentOutEndDate ? new Date(rent.rentOutEndDate) : null;
                    const monthlyRent = rent.rentOutMonthlyRental || rent.amount || 0;
                    const months =
                        startDate && endDate
                            ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
                            : rent.rentOutPeriods || 0;
                    const contractNumber = rent.rentOutTenancyNumber || '—';
                    const isExpired = endDate ? endDate < new Date() : false;
                    const ownerName = contractOwnerDisplayName(rent);
                    const tenantName = contractLesseeDisplayName(rent);

                    return (
                        <div
                            key={rent.id}
                            className={`grid grid-cols-[100px_1fr_1fr_1.5fr_1.2fr_1fr_minmax(0,1fr)_90px] gap-4 px-4 py-4 border-b text-sm transition-colors items-center last:border-0 group ${rowBorderHover} ${
                                isExpired ? 'bg-red-50/50 dark:bg-red-500/5' : ''
                            }`}
                        >
                            <div className="flex flex-col gap-1">
                                <span className="font-mono text-xs font-bold text-zinc-600 dark:text-white/70 tracking-tight">
                                    {contractNumber}
                                </span>
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full w-fit font-bold tracking-wider ${badgeClass}`}>
                                        {isLeaseIn ? '租入中' : '出租中'}
                                    </span>
                                    {isExpired && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full w-fit font-bold tracking-wider bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-500/30">
                                            已過期
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col overflow-hidden min-w-0">
                                <span className="font-semibold text-zinc-900 dark:text-white truncate" title={ownerName || undefined}>
                                    {ownerName || '—'}
                                </span>
                            </div>
                            <div className="flex flex-col overflow-hidden min-w-0">
                                <span className="font-semibold text-zinc-900 dark:text-white truncate" title={tenantName || undefined}>
                                    {tenantName || '—'}
                                </span>
                            </div>
                            <div className="text-zinc-700 dark:text-white/80 text-sm leading-relaxed line-clamp-2">
                                {rent.location || rent.rentOutAddressDetail || formData.name || '-'}
                            </div>
                            <div className="flex flex-col">
                                {startDate ? (
                                    <>
                                        <div className="text-zinc-800 dark:text-white/90 font-medium tabular-nums text-sm">
                                            {startDate.toLocaleDateString('zh-TW')}
                                        </div>
                                        <div className="text-zinc-600 dark:text-white/60 flex items-center gap-1 tabular-nums text-xs">
                                            <span>~</span> {endDate ? endDate.toLocaleDateString('zh-TW') : '-'}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1">
                                            <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-white/10 rounded font-semibold text-zinc-600 dark:text-white/60">
                                                {months}個月
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-zinc-500 dark:text-white/40 italic text-sm">未設定</span>
                                )}
                            </div>
                            <div className="text-right min-w-0">
                                <span
                                    className={`inline-block text-sm font-semibold tabular-nums whitespace-nowrap ${
                                        isLeaseIn
                                            ? 'text-violet-800 dark:text-violet-200'
                                            : 'text-amber-800 dark:text-amber-200'
                                    }`}
                                >
                                    ${monthlyRent.toLocaleString()}/月
                                </span>
                            </div>
                            <div className="text-zinc-600 dark:text-white/65 text-sm tabular-nums min-w-0">
                                {isLeaseIn
                                    ? rent.rentingDeposit != null && rent.rentingDeposit > 0
                                        ? `$${rent.rentingDeposit.toLocaleString()}`
                                        : '—'
                                    : rent.rentOutDepositReceived != null && rent.rentOutDepositReceived > 0
                                      ? `$${rent.rentOutDepositReceived.toLocaleString()}`
                                      : '—'}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={() => setEditingRent(rent as Rent)}
                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all"
                                    title="編輯合約記錄"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    disabled={unlinkingRentId === rent.id}
                                    onClick={() => handleUnlinkRent(rent.id!)}
                                    className={`p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-all ${unlinkingRentId === rent.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="取消物業連結"
                                >
                                    {unlinkingRentId === rent.id ? (
                                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    /** 以 OpenStreetMap 同款 Nominatim 搜尋，在下方地圖顯示標記（不經政府 ALS） */
    const handleMapSearch = async () => {
        const q = formData.address.trim();
        if (!q) {
            addNotification('請先輸入地址 / Please enter an address first', 'info');
            return;
        }

        setIsMapSearching(true);
        try {
            const response = await fetch(`/api/nominatim/search?q=${encodeURIComponent(q)}`);
            const data = await response.json();

            if (!response.ok) {
                addNotification(data?.error || '搜尋失敗 / Search failed', 'info');
                return;
            }

            const best = data?.best as { lat: number; lng: number; displayName?: string } | null;
            if (best && Number.isFinite(best.lat) && Number.isFinite(best.lng)) {
                setFormData((prev) => ({
                    ...prev,
                    location: {
                        lat: best.lat,
                        lng: best.lng,
                        address: prev.address,
                    },
                }));
                addNotification('已於地圖顯示（OpenStreetMap Nominatim）/ Shown on map', 'update');
            } else {
                addNotification(
                    '找不到地點，請改寫地址或在地圖上點擊設定位置 / Not found — try different wording or click the map',
                    'info',
                );
            }
        } catch (error) {
            console.error('Map search error:', error);
            addNotification('搜尋失敗 / Search failed', 'info');
        } finally {
            setIsMapSearching(false);
        }
    };

    // 編輯：物業 id 變更時重設表單與媒體，避免沿用上一筆資料
    useEffect(() => {
        if (!property?.id) return;
        setFormData(formStateFromProperty(property));
        setOrderedImages(property.images || []);
        setOrderedGeoMaps(property.geoMaps || []);
    }, [property?.id]);

    // Cleanup object URLs on unmount
    const orderedImagesRef = useRef(orderedImages);
    const orderedGeoMapsRef = useRef(orderedGeoMaps);
    orderedImagesRef.current = orderedImages;
    orderedGeoMapsRef.current = orderedGeoMaps;
    useEffect(() => () => {
        orderedImagesRef.current.forEach(img => typeof img === 'object' && URL.revokeObjectURL(img.preview));
        orderedGeoMapsRef.current.forEach(img => typeof img === 'object' && URL.revokeObjectURL(img.preview));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'images' | 'geoMaps') => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const list = type === 'images' ? orderedImages : orderedGeoMaps;
        const max = type === 'images' ? 5 : 2;
        const remainingSlots = max - list.length;

        if (remainingSlots <= 0) {
            setError(`最多只能上傳 ${max} 張${type === 'images' ? '圖片' : '地圖'} / Maximum ${max} allowed`);
            return;
        }

        const newItems = files.slice(0, remainingSlots).map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        if (type === 'images') {
            setOrderedImages(prev => [...prev, ...newItems]);
        } else {
            setOrderedGeoMaps(prev => [...prev, ...newItems]);
        }
    };

    const removeMediaItem = (index: number, type: 'images' | 'geoMaps') => {
        const setter = type === 'images' ? setOrderedImages : setOrderedGeoMaps;
        setter(prev => {
            const item = prev[index];
            if (typeof item === 'object') URL.revokeObjectURL(item.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const moveMediaItem = (type: 'images' | 'geoMaps', fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        const setter = type === 'images' ? setOrderedImages : setOrderedGeoMaps;
        setter(prev => {
            const arr = [...prev];
            const [removed] = arr.splice(fromIndex, 1);
            arr.splice(toIndex, 0, removed);
            return arr;
        });
    };

    const processAndUploadFiles = async (filesToUpload: { file: File }[], folder: string): Promise<string[]> => {
        if (filesToUpload.length === 0) return [];

        const compressedBlobs = await Promise.all(filesToUpload.map(f => compressImage(f.file)));

        const uploadPromises = compressedBlobs.map(async (blob: Blob, i) => {
            const uploadFormData = new FormData();
            uploadFormData.append('file', blob, filesToUpload[i].file.name);
            uploadFormData.append('folder', folder);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: uploadFormData,
            });

            const text = await res.text();
            let data: { url?: string; error?: string };
            try {
                data = JSON.parse(text);
            } catch {
                // Server returned HTML (e.g. Vercel error page) instead of JSON
                const hint = text.trimStart().startsWith('<') 
                    ? ' 請確認 Vercel 已設定 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY，且 Supabase Storage 的 properties bucket 已建立。'
                    : '';
                throw new Error(`上傳失敗：伺服器回傳非 JSON 格式${hint}`);
            }

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            if (!data.url) {
                throw new Error('上傳成功但未取得圖片網址');
            }
            return data.url;
        });

        return Promise.all(uploadPromises);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            // Extract pending (object) items for upload, preserve order
            const imagePending = orderedImages.filter((x): x is { file: File; preview: string } => typeof x === 'object');
            const geoPending = orderedGeoMaps.filter((x): x is { file: File; preview: string } => typeof x === 'object');

            const [uploadedImageUrls, uploadedGeoMapUrls] = await Promise.all([
                processAndUploadFiles(imagePending, 'properties'),
                processAndUploadFiles(geoPending, 'geomaps')
            ]);

            let imgUrlIdx = 0;
            let geoUrlIdx = 0;
            const finalImages = orderedImages.map(x => typeof x === 'string' ? x : uploadedImageUrls[imgUrlIdx++]);
            const finalGeoMaps = orderedGeoMaps.map(x => typeof x === 'string' ? x : uploadedGeoMapUrls[geoUrlIdx++]);

            const propertyData = {
                name: formData.name.trim(),
                code: formData.code.trim().toUpperCase(),
                address: formData.address.trim(),
                lotIndex: formData.lotIndex,
                lotArea: formData.lotArea,
                type: formData.type as Property['type'],
                status: formData.status as Property['status'],
                landUse: formData.landUse.join(',') as Property['landUse'],
                proprietorId: formData.proprietorId || undefined,
                tenantId: formData.tenantId || undefined,
                googleDrivePlanUrl: formData.googleDrivePlanUrl.trim(),
                hasPlanningPermission: formData.hasPlanningPermission || '',
                location: formData.location,
                images: finalImages,
                geoMaps: finalGeoMaps,
                notes: formData.notes,
                createdBy: formData.createdBy || undefined,
            };

            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            if (property?.id) {
                const updated = await updateProperty(property.id, propertyData);
                if (!updated) {
                    setError(propertiesError || '儲存失敗，請檢查網路或稍後再試。Save failed.');
                    return;
                }

                addNotification(`Property "${formData.name}" updated at ${timeStr}`, 'update');
            } else {
                const newId = await addProperty(propertyData);
                if (!newId) {
                    setError(propertiesError || '新增失敗，請檢查網路或稍後再試。Create failed.');
                    return;
                }

                addNotification(`Property "${formData.name}" created at ${timeStr}`, 'create');
            }

            queryClient.invalidateQueries({ queryKey: ['properties'] });
            queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
            if (property?.id) {
                queryClient.invalidateQueries({ queryKey: ['property-with-relations', property.id] });
            }

            onSuccess();
        } catch (err: any) {
            console.error('Submit error:', err);
            setError(`Save failed: ${err.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleProprietorCreated = async (id: string, proprietorData?: Partial<Proprietor>) => {
        if (proprietorData) {
            setPendingProprietors(prev => ({ ...prev, [id]: proprietorData }));
        }
        await queryClient.refetchQueries({ queryKey: ['proprietors'] });
        if (proprietorModalMode === 'tenant') {
            setFormData(prev => ({ ...prev, tenantId: id }));
        } else if (!proprietorModalInitial?.id) {
            // 僅「新增業主」時才加入物業業主列表；編輯既有業主不重複加入
            setFormData(prev => ({
                ...prev,
                proprietorIds: [...prev.proprietorIds, id],
                proprietorId: prev.proprietorIds.length === 0 ? id : prev.proprietorId
            }));
        }
        setShowProprietorModal(false);
        setProprietorModalInitial(null);
        if (proprietorData) {
            setTimeout(() => setPendingProprietors(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            }), 2000);
        }
    };

    const handleRentCreated = async () => {
        setSaving(true);
        try {
            await queryClient.invalidateQueries({ queryKey: ['rents'] });
            await queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
            await queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
            if (property?.id) {
                await queryClient.invalidateQueries({ queryKey: ['property-with-relations', property.id] });
            }
        } finally {
            setSaving(false);
            setShowRentModal(false);
        }
    };

    const handleUnlinkProprietor = (idToRemove?: string) => {
        if (window.confirm('確定要取消業主連結嗎？')) {
            if (idToRemove) {
                // Remove specific proprietor
                setFormData(prev => {
                    const newIds = prev.proprietorIds.filter(id => id !== idToRemove);
                    return {
                        ...prev,
                        proprietorIds: newIds,
                        proprietorId: newIds.length > 0 ? newIds[0] : '' // Update legacy field
                    };
                });
            } else {
                // Clear all
                setFormData(prev => ({ ...prev, proprietorIds: [], proprietorId: '' }));
            }
        }
    };

    const handleUnlinkTenant = () => {
        if (window.confirm('確定要取消承租人連結嗎？/ Are you sure you want to unlink the tenant?')) {
            setFormData(prev => ({ ...prev, tenantId: '' }));
        }
    };

    const handleUnlinkRent = async (rentId: string) => {
        if (!window.confirm('確定要取消與此物業的連結嗎？租務記錄將會保留。/ Are you sure you want to unlink this rent record? The record will be kept.')) {
            return;
        }

        setUnlinkingRentId(rentId);
        try {
            const success = await updateRent(rentId, { propertyId: null } as any);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ['rents'] });
                queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
                queryClient.invalidateQueries({ queryKey: ['sub_landlords'] }); // 刷新二房东列表，因为tenancyNumber可能已更新
                addNotification('租務記錄已取消連結 / Rent record unlinked', 'update');
            } else {
                setError('Failed to unlink rent record');
            }
        } finally {
            setUnlinkingRentId(null);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed top-0 left-0 w-screen h-screen bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-5xl lg:max-w-6xl md:max-h-[90vh] bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                            {property ? '編輯物業' : '新增物業'}
                        </h2>
                        <p className="text-zinc-500 dark:text-white/50 text-sm mt-1">請在下方填寫物業詳情</p>
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
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {(error || propertiesError) && (
                        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
                            {error || propertiesError}
                        </div>
                    )}

                    {/* Images and Geo Maps Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Images */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                圖片 (最多 5 張, 總計 5MB)
                            </label>
                            <p className="text-xs text-zinc-500 dark:text-white/40">第一張會是最新圖片</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {orderedImages.map((item, index) => (
                                    <div
                                        key={`img-${index}`}
                                        draggable
                                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', `images:${index}`); e.dataTransfer.effectAllowed = 'move'; }}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-purple-500'); }}
                                        onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-purple-500'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-purple-500');
                                            const raw = e.dataTransfer.getData('text/plain');
                                            if (raw.startsWith('images:')) {
                                                const from = parseInt(raw.slice(7), 10);
                                                if (!isNaN(from) && from !== index) moveMediaItem('images', from, index);
                                            }
                                        }}
                                        className="relative group aspect-square cursor-grab active:cursor-grabbing rounded-xl border border-zinc-200 dark:border-white/10 transition-all"
                                    >
                                        <img
                                            src={typeof item === 'string' ? item : item.preview}
                                            alt={`Property ${index + 1}`}
                                            className="w-full h-full object-cover rounded-xl pointer-events-none"
                                        />
                                        {typeof item === 'object' && (
                                            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                <span className="text-white text-xs font-medium">Pending Upload</span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeMediaItem(index, 'images')}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {orderedImages.length < 5 && (
                                    <div className="w-full h-full aspect-square relative rounded-xl overflow-hidden hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                        <FileUpload onChange={(files) => {
                                            if (files.length > 0) handleImageUpload({ target: { files } } as any, 'images');
                                        }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Geo Maps */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                地圖 (最多 2 張)
                            </label>
                            <p className="text-xs text-zinc-500 dark:text-white/40">第一張為主要顯示</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {orderedGeoMaps.map((item, index) => (
                                    <div
                                        key={`geo-${index}`}
                                        draggable
                                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', `geoMaps:${index}`); e.dataTransfer.effectAllowed = 'move'; }}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-purple-500'); }}
                                        onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-purple-500'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-purple-500');
                                            const raw = e.dataTransfer.getData('text/plain');
                                            if (raw.startsWith('geoMaps:')) {
                                                const from = parseInt(raw.slice(8), 10);
                                                if (!isNaN(from) && from !== index) moveMediaItem('geoMaps', from, index);
                                            }
                                        }}
                                        className="relative group aspect-square cursor-grab active:cursor-grabbing rounded-xl border border-zinc-200 dark:border-white/10 transition-all"
                                    >
                                        <img
                                            src={typeof item === 'string' ? item : item.preview}
                                            alt={`Geo Map ${index + 1}`}
                                            className="w-full h-full object-cover rounded-xl pointer-events-none"
                                        />
                                        {typeof item === 'object' && (
                                            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                <span className="text-white text-xs font-medium">Pending Upload</span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeMediaItem(index, 'geoMaps')}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {orderedGeoMaps.length < 2 && (
                                    <div className="w-full h-full aspect-square relative rounded-xl overflow-hidden hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                        <FileUpload onChange={(files) => {
                                            if (files.length > 0) handleImageUpload({ target: { files } } as any, 'geoMaps');
                                        }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">名稱 *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                placeholder="請輸入物業名稱"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">編號 *</label>
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                placeholder="e.g. P001"
                            />
                        </div>
                    </div>

                    {/* Admin only: Uploader (createdBy) selection */}
                    {isAdmin && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">上載者 (Uploader)</label>
                            <AnimatedSelect
                                name="createdBy"
                                value={formData.createdBy || property?.createdBy || ''}
                                onChange={(value) => setFormData(prev => ({ ...prev, createdBy: value }))}
                                options={[
                                    { value: '', label: '使用目前用戶 / Use current user' },
                                    ...(users || []).map(u => ({
                                        value: u.id,
                                        label: u.displayName || u.username
                                    }))
                                ]}
                                placeholder="選擇上載者"
                            />
                            <p className="text-[10px] text-zinc-500 dark:text-white/40 italic">
                                * 只有管理員可以更改上載者 / Only admins can change the uploader
                            </p>
                        </div>
                    )}

                    {/* 地址：OpenStreetMap Nominatim 搜尋後於下方地圖顯示 */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">地址</label>
                        <p className="text-[11px] text-zinc-500 dark:text-white/45 leading-snug">
                            輸入後點「在地圖上顯示」，使用與{' '}
                            <a
                                href="https://www.openstreetmap.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 dark:text-purple-400 underline underline-offset-2"
                            >
                                OpenStreetMap
                            </a>{' '}
                            相同的 Nominatim 搜尋；可再拖曳標記微調。
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                placeholder="輸入地址..."
                            />
                            <button
                                type="button"
                                onClick={handleMapSearch}
                                disabled={isMapSearching || !formData.address.trim()}
                                className="px-4 py-3 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-xl font-medium hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                            >
                                {isMapSearching ? (
                                    <svg className="animate-spin h-4 w-4 text-purple-700 dark:text-purple-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                    </svg>
                                )}
                                在地圖上顯示
                            </button>
                        </div>
                        {formData.location && (
                            <p className="text-xs text-zinc-500 dark:text-white/40 flex items-center gap-1">
                                <span className="text-emerald-500">✓</span> 已定位: Lat: {formData.location.lat.toFixed(6)}, Lng: {formData.location.lng.toFixed(6)}
                            </p>
                        )}
                        <LocationPickerMap
                            location={formData.location}
                            onChange={(loc) => setFormData(prev => ({ ...prev, location: { ...loc, address: prev.address } }))}
                        />
                    </div>

                    {/* Property Lot Index */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">物業地段</label>
                            {isAuthenticated && (
                                <button
                                    type="button"
                                    onClick={() => setShowLotAddModal(true)}
                                    className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300"
                                >
                                    + 新增地段
                                </button>
                            )}
                        </div>
                        <div className="min-h-[48px] px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl space-y-2">
                            {lotEntries.length === 0 ? (
                                <p className="text-sm text-zinc-400 dark:text-white/40">尚未新增地段</p>
                            ) : (
                                lotEntries.map((entry, i) => (
                                    <div key={i} className="flex items-center gap-2 flex-wrap">
                                        {editingLotIndex === i ? (
                                            <>
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingLotType('new')}
                                                        className={`px-2 py-0.5 rounded text-xs font-medium ${editingLotType === 'new' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/50' : 'bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/80'}`}
                                                    >
                                                        新
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingLotType('old')}
                                                        className={`px-2 py-0.5 rounded text-xs font-medium ${editingLotType === 'old' ? 'bg-zinc-300 dark:bg-white/20 text-zinc-700 dark:text-white ring-2 ring-zinc-500/50' : 'bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/80'}`}
                                                    >
                                                        舊
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={editingLotValue}
                                                    onChange={(e) => setEditingLotValue(e.target.value)}
                                                    className="flex-1 min-w-0 px-3 py-1.5 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white"
                                                    placeholder="例如: DD 111 LOT 1523, 1539"
                                                    autoFocus
                                                />
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={saveEditLotEntry}
                                                        disabled={!editingLotValue.trim()}
                                                        className="px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-xs"
                                                    >
                                                        確認
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEditLotEntry}
                                                        className="px-3 py-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-white/70 text-xs"
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${entry.type === 'new' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-white/70'}`}>
                                                    {entry.type === 'new' ? '新' : '舊'}
                                                </span>
                                                <span className="flex-1 text-sm text-zinc-900 dark:text-white break-all">{entry.value}</span>
                                                {isAuthenticated && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => startEditLotEntry(i)}
                                                            className="p-1 text-zinc-400 hover:text-purple-500 rounded"
                                                            title="編輯"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLotEntry(i)}
                                                            className="p-1 text-zinc-400 hover:text-red-500 rounded"
                                                            title="移除"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Lot Add Modal */}
                        {showLotAddModal && (
                            <div className="mt-3 p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10 space-y-3">
                                <p className="text-sm font-medium text-zinc-700 dark:text-white/80">新增地段</p>
                                {lotAddMode === null ? (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setLotAddMode('new')}
                                            className="px-4 py-2 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-500/30 text-sm"
                                        >
                                            新地段
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLotAddMode('old')}
                                            className="px-4 py-2 bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-white/80 rounded-lg hover:bg-zinc-300 dark:hover:bg-white/20 text-sm"
                                        >
                                            舊地段
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowLotAddModal(false); setLotAddMode(null); }}
                                            className="px-4 py-2 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white text-sm"
                                        >
                                            取消
                                        </button>
                                    </div>
                                ) : lotAddMode === 'new' ? (
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={tempLotInput}
                                            onChange={(e) => setTempLotInput(e.target.value)}
                                            placeholder="例如: DD 111 LOT 1523, 1539"
                                            className="flex-1 px-3 py-2 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => appendToLotIndex(tempLotInput, 'new')}
                                            disabled={!tempLotInput.trim()}
                                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm"
                                        >
                                            確認
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setLotAddMode(null); setTempLotInput(''); }}
                                            className="px-4 py-2 text-zinc-500 hover:text-zinc-700 text-sm"
                                        >
                                            返回
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={tempLotInput}
                                            onChange={(e) => setTempLotInput(e.target.value)}
                                            placeholder="輸入舊地段，例如: DD 111 LOT 1523, 1539"
                                            className="flex-1 px-3 py-2 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => appendToLotIndex(tempLotInput, 'old')}
                                            disabled={!tempLotInput.trim()}
                                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm"
                                        >
                                            確認
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setLotAddMode(null); setTempLotInput(''); }}
                                            className="px-4 py-2 text-zinc-500 hover:text-zinc-700 text-sm"
                                        >
                                            返回
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Type, Status, Land Use */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">類型</label>
                            <AnimatedSelect
                                name="type"
                                value={formData.type}
                                onChange={(value) => handleChange({ target: { name: 'type', value } } as any)}
                                options={propertyTypes}
                                placeholder="選擇類型"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">狀態</label>
                            <AnimatedSelect
                                name="status"
                                value={formData.status}
                                onChange={(value) => handleChange({ target: { name: 'status', value } } as any)}
                                options={propertyStatuses}
                                placeholder="選擇狀態"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">土地用途</label>
                            <AnimatedMultiSelect
                                name="landUse"
                                values={formData.landUse}
                                onChange={(values) => handleChange({ target: { name: 'landUse', value: values } } as any)}
                                options={landUseTypes}
                                placeholder="請選擇"
                            />
                        </div>
                    </div>

                    {/* Lot Area */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">地段面積</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                name="lotArea"
                                value={formatLotAreaForInput(formData.lotArea)}
                                onChange={(e) => {
                                    const raw = parseLotAreaInput(e.target.value);
                                    setFormData(prev => ({ ...prev, lotArea: raw }));
                                }}
                                className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                placeholder="e.g. 32,980"
                            />
                            <span className="text-sm text-zinc-500 dark:text-white/50 shrink-0">平方英呎</span>
                        </div>
                    </div>

                    {/* Proprietor Section (Multi-Select) */}
                    {property && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">業主</label>
                                <div className="flex items-center gap-2">
                                    {formData.proprietorIds.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleUnlinkProprietor()}
                                            className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 transition-colors border border-red-100 dark:border-none"
                                            title="清除全部業主"
                                        >
                                            ✕ 清除全部
                                        </button>
                                    )}
                                    {isAuthenticated && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setProprietorModalMode('proprietor');
                                                setProprietorModalInitial(null);
                                                setShowProprietorModal(true);
                                            }}
                                            className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300"
                                        >
                                            + 新增
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Multi-Select Dropdown */}
                            <AnimatedSelect
                                value=""
                                onChange={(selectedId) => {
                                    if (selectedId && !formData.proprietorIds.includes(selectedId)) {
                                        setFormData(prev => ({
                                            ...prev,
                                            proprietorIds: [...prev.proprietorIds, selectedId],
                                            proprietorId: prev.proprietorIds.length === 0 ? selectedId : prev.proprietorId
                                        }));
                                    }
                                }}
                                options={[
                                    { value: '', label: '選擇業主以新增...' },
                                    ...proprietorsList
                                        .filter(p => !formData.proprietorIds.includes(p.id!))
                                        .map(p => ({ value: p.id!, label: p.name }))
                                ]}
                                placeholder="選擇業主以新增..."
                            />

                            {/* Selected Proprietors Display */}
                            {formData.proprietorIds.length === 0 ? (
                                <div className="p-6 bg-zinc-50 dark:bg-white/5 rounded-xl text-center text-zinc-600 dark:text-white/60 text-base">
                                    尚未指定業主
                                </div>
                            ) : (
                                <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-[4rem_minmax(0,1fr)_6rem_minmax(0,1fr)_4.5rem] gap-x-2.5 gap-y-1 px-3 py-3 bg-zinc-100/80 dark:bg-white/5 text-sm font-semibold text-zinc-700 dark:text-white/80 uppercase tracking-wider border-b border-zinc-200 dark:border-white/10 items-center">
                                        <div className="shrink-0">代碼</div>
                                        <div className="min-w-0">業主名稱</div>
                                        <div className="shrink-0 whitespace-nowrap">業主性質</div>
                                        <div className="min-w-0">擁有人類別</div>
                                        <div className="text-center shrink-0 justify-self-center">操作</div>
                                    </div>
                                    {/* Table Rows */}
                                    {formData.proprietorIds.map((propId) => {
                                        const selectedProprietor = proprietorsList.find(p => p.id === propId) || (pendingProprietors[propId] as Proprietor | undefined);

                                        if (!selectedProprietor?.name && !pendingProprietors[propId]?.name) return null;

                                        const typeLabel = selectedProprietor?.type === 'company' ? '公司' : selectedProprietor?.type === 'individual' ? '個人' : '-';
                                        const categoryLabel = selectedProprietor?.category
                                            ? proprietorCategoryLabelZh(selectedProprietor.category, 'form')
                                            : '-';

                                        return (
                                            <div key={propId} className="grid grid-cols-[4rem_minmax(0,1fr)_6rem_minmax(0,1fr)_4.5rem] gap-x-2.5 gap-y-1 px-3 py-3 border-b border-zinc-100 dark:border-white/5 text-sm hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-colors items-center last:border-0">
                                                {/* 代碼 */}
                                                <div className="text-zinc-600 dark:text-white/60 font-mono text-sm font-medium shrink-0">
                                                    {selectedProprietor?.code || '-'}
                                                </div>

                                                {/* 業主名稱 */}
                                                <div className="font-medium text-zinc-900 dark:text-white truncate text-sm min-w-0" title={selectedProprietor?.name || ''}>
                                                    {selectedProprietor?.name || '(載入中...)'}
                                                </div>

                                                {/* 業主性質 */}
                                                <div className="text-zinc-700 dark:text-white/80 text-sm shrink-0 whitespace-nowrap">
                                                    {typeLabel}
                                                </div>

                                                {/* 擁有人類別 */}
                                                <div className="text-zinc-700 dark:text-white/80 text-sm min-w-0 leading-snug">
                                                    {categoryLabel}
                                                </div>

                                                {/* 操作：編輯業主、移除連結 */}
                                                <div className="flex items-center justify-center gap-0.5 shrink-0 justify-self-center">
                                                    {isAuthenticated && selectedProprietor?.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setProprietorModalMode('proprietor');
                                                                setProprietorModalInitial(selectedProprietor as Proprietor);
                                                                setShowProprietorModal(true);
                                                            }}
                                                            className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                                                            title="編輯業主"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnlinkProprietor(propId)}
                                                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                                                        title="移除業主連結"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rent Records (only show when editing) */}
                    {property?.id && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <label className="block text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">租務管理</label>
                                {isAuthenticated && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowContractModal(true)}
                                            className="px-4 py-2 bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-500/30 border border-amber-100 dark:border-amber-500/30 text-sm font-medium transition-all duration-300 flex items-center gap-2"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            新增合約記錄
                                        </button>
                                        {hasContractRecord && (
                                            <button
                                                type="button"
                                                onClick={() => setShowRentModal(true)}
                                                className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 border border-purple-100 dark:border-purple-500/30 text-sm font-medium transition-all duration-300 flex items-center gap-2"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                                </svg>
                                                新增交/收租記錄
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!hasContractRecord && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">請先新增第一個合約記錄，之後才可新增交／收租記錄。</p>
                            )}

                            {/* Select to link existing rent records (hidden) */}
                            <div className="relative group hidden">
                                <AnimatedSelect
                                    value=""
                                    onChange={async (selectedRentId) => {
                                        if (selectedRentId && property?.id) {
                                            const rentToLink = (allRents || []).find(r => r.id === selectedRentId);
                                            const updates: Partial<Rent> = { propertyId: property.id };

                                            if (rentToLink && !rentToLink.location && !rentToLink.rentOutAddressDetail) {
                                                updates.location = formData.name;
                                                if (rentToLink.type === 'rent_out') {
                                                    updates.rentOutAddressDetail = formData.name;
                                                }
                                            }

                                            const success = await updateRent(selectedRentId, updates);
                                            if (success) {
                                                await queryClient.invalidateQueries({ queryKey: ['rents'] });
                                                await queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
                                                await queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
                                                addNotification('租金記錄已連結 / Rent record linked', 'update');
                                            }
                                        }
                                    }}
                                    options={[
                                        { value: '', label: rentsLoading ? '載入中...' : '選擇現有租金記錄以連結...' },
                                        ...((allRents || [])
                                            .filter(r => !r.propertyId || r.propertyId === '' || r.propertyId === 'null' || (r as any).propertyId == null)
                                            .map(r => {
                                                const monthlyRent = r.type === 'rent_out' ? r.rentOutMonthlyRental : r.rentingMonthlyRental;
                                                const tenantName = r.type === 'rent_out'
                                                    ? (proprietors || []).find(p => p.id === r.tenantId)?.name
                                                    : (proprietors || []).find(p => p.id === r.proprietorId)?.name;
                                                const endDate =
                                                    r.type === 'rent_out'
                                                        ? getRentOutCollectionDisplayPeriod(r as Rent).end || r.rentOutEndDate
                                                        : r.rentingEndDate || (r as any).endDate;
                                                const isExpired = endDate ? new Date(endDate) < new Date(new Date().setHours(0, 0, 0, 0)) : false;

                                                return {
                                                    value: r.id!,
                                                    label: `${r.type === 'rent_out' ? '收租' : '交租'} - ${tenantName || '未指定'} - $${(monthlyRent || 0).toLocaleString()}/月${isExpired ? ' (已過期)' : ''}`
                                                };
                                            }))
                                    ]}
                                    placeholder="選擇現有租金記錄以連結..."
                                />
                            </div>

                            <div className="space-y-10">
                                <div>
                                    <h4 className="text-base font-bold text-emerald-700 dark:text-emerald-400 mb-4 flex items-center gap-2 px-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                        收租記錄 (Rent Out Records)
                                    </h4>
                                    {renderRentTable(rentOutRents, 'landlord')}
                                </div>

                                <div>
                                    <h4 className="text-base font-bold text-indigo-700 dark:text-indigo-400 mb-4 flex items-center gap-2 px-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                                        交租記錄 (Renting Records)
                                    </h4>
                                    {renderRentTable(rentingRents, 'simple')}
                                </div>

                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-base font-bold text-violet-900 dark:text-violet-100 mb-3 flex items-center gap-2 px-1">
                                            <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.45)]"></div>
                                            租賃合約
                                        </h4>
                                        {renderContractTable(leaseInContractRents, 'lease_in')}
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2 px-1">
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                                            出租合約
                                        </h4>
                                        {renderContractTable(leaseOutContractRents, 'lease_out')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Google Drive URL and Planning Permission */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">Google Drive 規劃圖 URL</label>
                            <input
                                type="url"
                                name="googleDrivePlanUrl"
                                value={formData.googleDrivePlanUrl}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                placeholder="https://drive.google.com/..."
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                最新規劃許可申請
                            </label>
                            <input
                                type="text"
                                name="hasPlanningPermission"
                                value={formData.hasPlanningPermission}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium"
                                placeholder="請輸入最新的規劃許可申請詳情..."
                            />
                        </div>
                    </div>

                    {/* Notes Field (Rich Text) */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">備註</label>
                        <RichTextEditor
                            value={formData.notes}
                            onChange={(content) => setFormData(prev => ({ ...prev, notes: content }))}
                            placeholder="請輸入備註資訊..."
                        />
                    </div>

                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-100 dark:border-white/5 bg-white dark:bg-transparent">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                    >
                        取消
                    </button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                className="flex items-center gap-2"
                            >
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>處理中...</span>
                            </motion.div>
                        ) : (
                            property ? '更新物業' : '新增物業'
                        )}
                    </motion.button>
                </div>
            </motion.div>

            {/* Proprietor Modal */}
            {showProprietorModal && (
                <ProprietorModal
                    key={proprietorModalInitial?.id ?? 'new-proprietor'}
                    mode={proprietorModalMode}
                    propertyCode={property?.code || formData.code}
                    initialData={proprietorModalInitial ?? undefined}
                    initialEditing={proprietorModalInitial ? true : undefined}
                    onClose={() => {
                        setShowProprietorModal(false);
                        setProprietorModalInitial(null);
                    }}
                    onSuccess={handleProprietorCreated}
                />
            )}

            {/* Rent Modal */}
            {showRentModal && property?.id && (
                <RentModal
                    propertyId={property.id}
                    defaultLocation={formData.name}
                    allowedTypes={['rent_out', 'renting']}
                    presetTenantId={contractOwnerId}
                    presetSubLandlordId={contractSubLandlordId}
                    presetCurrentTenantId={contractCurrentTenantId}
                    onClose={() => setShowRentModal(false)}
                    onSuccess={handleRentCreated}
                />
            )}

            {/* Contract Modal (新增合約記錄) */}
            {showContractModal && property?.id && (
                <RentModal
                    propertyId={property.id}
                    defaultLocation={formData.name}
                    defaultType="contract"
                    allowedTypes={['contract']}
                    onClose={() => setShowContractModal(false)}
                    onSuccess={() => {
                        setShowContractModal(false);
                        queryClient.invalidateQueries({ queryKey: ['rents'] });
                        queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
                        queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
                        addNotification('合約記錄已建立', 'update');
                    }}
                />
            )}

            {/* Edit Rent Modal */}
            {editingRent && (
                <RentModal
                    propertyId={property?.id}
                    defaultLocation={formData.name}
                    rent={editingRent}
                    onClose={() => setEditingRent(null)}
                    onSuccess={() => {
                        setEditingRent(null);
                        queryClient.invalidateQueries({ queryKey: ['rents'] });
                        queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
                        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
                        addNotification('租金記錄已更新', 'update');
                    }}
                />
            )}
        </>
    );
}
