'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useProperties, useProprietorsQuery, useRents, useRentsQuery } from '@/hooks/useStorage';
import { fileToBase64, validateImageUpload, compressImage } from '@/lib/imageUtils';
import type { Property, Proprietor, Rent } from '@/lib/db';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import ProprietorModal from '@/components/properties/ProprietorModal';
import RentModal from '@/components/properties/RentModal';
import RichTextEditor from '@/components/common/RichTextEditor';
import AnimatedSelect from '@/components/ui/AnimatedSelect';
import { FileUpload } from '@/components/ui/file-upload';

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
    { value: 'unknown', label: '未知' },
    { value: 'open_storage', label: '露天倉儲' },
    { value: 'residential_a', label: '住宅(甲)' },
    { value: 'open_space', label: '開放空間' },
    { value: 'village_dev', label: '鄉村式發展' },
    { value: 'conservation_area', label: '保育區' },
    { value: 'residential_c', label: '住宅(丙類)' },
    { value: 'recreation_use', label: '休憩用地' },
];

export default function PropertyForm({ property, onClose, onSuccess }: PropertyFormProps) {
    const queryClient = useQueryClient();
    const { addProperty, updateProperty } = useProperties();
    const { data: proprietors } = useProprietorsQuery();
    const { data: allRents } = useRentsQuery();
    const { updateRent, deleteRent } = useRents();
    const { addNotification } = useNotifications();
    const { isAuthenticated } = useAuth();

    // Inline edit state
    const [editingRentId, setEditingRentId] = useState<string | null>(null);
    const [tempRentData, setTempRentData] = useState<Partial<Rent>>({});
    const [editingRent, setEditingRent] = useState<Rent | null>(null);

    const [showProprietorModal, setShowProprietorModal] = useState(false);
    const [showRentModal, setShowRentModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [proprietorModalMode, setProprietorModalMode] = useState<'proprietor' | 'tenant'>('proprietor');
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const addressInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: property?.name || '',
        code: property?.code || '',
        address: property?.address || '',
        lotIndex: property?.lotIndex || '',
        lotArea: property?.lotArea || '',
        type: property?.type || 'group_asset',
        status: property?.status || 'holding',
        landUse: property?.landUse || 'unknown',
        proprietorId: property?.proprietorId || '', // Legacy - kept for compatibility
        proprietorIds: property?.proprietorIds || (property?.proprietorId ? [property.proprietorId] : []), // Multi-select
        tenantId: property?.tenantId || '',
        googleDrivePlanUrl: property?.googleDrivePlanUrl || '',
        hasPlanningPermission: property?.hasPlanningPermission || '',
        location: property?.location || null,
        images: property?.images || [],
        geoMaps: property?.geoMaps || [],
        notes: property?.notes || '',
    });

    const proprietorsList = useMemo(() => (proprietors || []).filter(p => p.code?.startsWith('A')), [proprietors]);
    const tenantsList = useMemo(() => (proprietors || []).filter(p => p.code?.startsWith('T')), [proprietors]);

    const rents = useMemo(() => {
        if (!property?.id || !allRents) return [];
        return allRents.filter(r => r.propertyId === property.id);
    }, [property?.id, allRents]);

    // Initialize Google Places Autocomplete
    useEffect(() => {
        if (typeof google !== 'undefined' && addressInputRef.current && !autocompleteRef.current) {
            autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'hk' },
            });

            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current?.getPlace();
                if (place?.geometry?.location) {
                    setFormData(prev => ({
                        ...prev,
                        address: place.formatted_address || '',
                        location: {
                            lat: place.geometry!.location!.lat(),
                            lng: place.geometry!.location!.lng(),
                            address: place.formatted_address || '',
                        },
                    }));
                }
            });
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'images' | 'geoMaps') => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const validation = validateImageUpload(
            formData[type],
            files,
            type === 'images' ? 'property' : 'geomap'
        );

        if (!validation.valid) {
            setError(validation.error || 'Invalid upload');
            return;
        }

        try {
            const compressedBlobs = await Promise.all(files.map(f => compressImage(f)));
            const base64Images = await Promise.all(compressedBlobs.map((blob: Blob) => fileToBase64(blob)));

            setFormData(prev => ({
                ...prev,
                [type]: [...prev[type], ...base64Images],
            }));
            setError('');
        } catch (err) {
            console.error('Upload/Compression error:', err);
            setError('圖片處理失敗 / Failed to process images');
        }
    };

    const removeImage = (index: number, type: 'images' | 'geoMaps') => {
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const propertyData = {
                name: formData.name,
                code: formData.code,
                address: formData.address,
                lotIndex: formData.lotIndex,
                lotArea: formData.lotArea,
                type: formData.type as Property['type'],
                status: formData.status as Property['status'],
                landUse: formData.landUse as Property['landUse'],
                proprietorId: formData.proprietorId || undefined,
                tenantId: formData.tenantId || undefined,
                googleDrivePlanUrl: formData.googleDrivePlanUrl,
                hasPlanningPermission: formData.hasPlanningPermission || '',
                location: formData.location,
                images: formData.images,
                geoMaps: formData.geoMaps,
                notes: formData.notes,
            };

            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            if (property?.id) {
                const updated = await updateProperty(property.id, propertyData);
                if (!updated) return; // Error already handled in hook

                addNotification(
                    `Property "${formData.name}" updated at ${timeStr}`,
                    'update'
                );
            } else {
                const newId = await addProperty(propertyData);
                if (!newId) return; // Error already handled in hook

                addNotification(
                    `Property "${formData.name}" created at ${timeStr}`,
                    'create'
                );
            }

            // Invalidate all relevant queries to ensure data consistency
            queryClient.invalidateQueries({ queryKey: ['properties'] });
            queryClient.invalidateQueries({ queryKey: ['properties-with-relations'] });
            // Also invalidate the individual property detail query (used by detail pages)
            if (property?.id) {
                queryClient.invalidateQueries({ queryKey: ['property-with-relations', property.id] });
            }

            onSuccess();
        } catch (err) {
            setError('Failed to save property');
        } finally {
            setSaving(false);
        }
    };

    const handleProprietorCreated = async (id: string) => {
        queryClient.invalidateQueries({ queryKey: ['proprietors'] });
        if (proprietorModalMode === 'tenant') {
            setFormData(prev => ({ ...prev, tenantId: id }));
        } else {
            // Add to proprietorIds array
            setFormData(prev => ({
                ...prev,
                proprietorIds: [...prev.proprietorIds, id],
                proprietorId: prev.proprietorIds.length === 0 ? id : prev.proprietorId // Keep first as legacy
            }));
        }
        setShowProprietorModal(false);
    };

    const handleRentCreated = async () => {
        queryClient.invalidateQueries({ queryKey: ['rents'] });
        setShowRentModal(false);
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

    const handleDeleteRent = async (rentId: string) => {
        if (!window.confirm('確定要刪除此租金記錄嗎？這將斷開與物業的連結。/ Are you sure you want to delete this rent record? This will unlink it from the property.')) {
            return;
        }

        const success = await deleteRent(rentId);
        if (success) {
            queryClient.invalidateQueries({ queryKey: ['rents'] });
            addNotification('租金記錄已刪除 / Rent record deleted', 'delete');
        } else {
            setError('Failed to delete rent record');
        }
    };

    const handleStartInlineEdit = (propId: string, rent: Rent) => {
        setEditingRentId(propId);
        setTempRentData(rent);
    };

    const handleSaveInlineRent = async (propId: string) => {
        if (!tempRentData.id) return;

        setSaving(true);
        try {
            const success = await updateRent(tempRentData.id, tempRentData);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ['rents'] });
                addNotification('租金資訊已更新 / Rent information updated', 'update');
                setEditingRentId(null);
            } else {
                setError('Failed to update rent');
            }
        } catch (err) {
            setError('Error updating rent');
        } finally {
            setSaving(false);
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
                className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-3xl md:max-h-[90vh] bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
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
                    {error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Images and Geo Maps Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Images */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                圖片 (最多 5 張, 總計 5MB)
                            </label>
                            <div className="flex flex-wrap gap-3">
                                {formData.images.map((img, index) => (
                                    <div key={index} className="relative group">
                                        <img
                                            src={img}
                                            alt={`Property ${index + 1}`}
                                            className="w-20 h-20 object-cover rounded-xl border border-zinc-200 dark:border-white/10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index, 'images')}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {formData.images.length < 5 && (
                                    <div className="w-full mt-2">
                                        <FileUpload onChange={(files) => {
                                            if (files.length > 0) {
                                                handleImageUpload({ target: { files } } as any, 'images');
                                            }
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
                            <div className="flex flex-wrap gap-3">
                                {formData.geoMaps.map((img, index) => (
                                    <div key={index} className="relative group">
                                        <img
                                            src={img}
                                            alt={`Geo Map ${index + 1}`}
                                            className="w-20 h-20 object-cover rounded-xl border border-zinc-200 dark:border-white/10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index, 'geoMaps')}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {formData.geoMaps.length < 2 && (
                                    <div className="w-full mt-2">
                                        <FileUpload onChange={(files) => {
                                            if (files.length > 0) {
                                                handleImageUpload({ target: { files } } as any, 'geoMaps');
                                            }
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

                    {/* Address with Autocomplete */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">地址</label>
                        <input
                            ref={addressInputRef}
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            placeholder="開始輸入以搜尋..."
                        />
                        {formData.location && (
                            <p className="text-xs text-zinc-500 dark:text-white/40">
                                📍 Lat: {formData.location.lat.toFixed(6)}, Lng: {formData.location.lng.toFixed(6)}
                            </p>
                        )}
                    </div>

                    {/* Property Lot Index */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">物業地段</label>
                        <input
                            type="text"
                            name="lotIndex"
                            value={formData.lotIndex}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            placeholder="例如: DD120 Lot 123"
                        />
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
                            <AnimatedSelect
                                name="landUse"
                                value={formData.landUse}
                                onChange={(value) => handleChange({ target: { name: 'landUse', value } } as any)}
                                options={landUseTypes}
                                placeholder="選擇土地用途"
                            />
                        </div>
                    </div>

                    {/* Lot Area */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">地段面積</label>
                        <input
                            type="text"
                            name="lotArea"
                            value={formData.lotArea}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            placeholder="e.g. 27180"
                        />
                    </div>

                    {/* Proprietor Section (Multi-Select) */}
                    {property && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">業主</label>
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
                                                setShowProprietorModal(true);
                                            }}
                                            className="px-3 py-1.5 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/30 transition-colors border border-purple-100 dark:border-none text-sm"
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
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl text-center text-zinc-400 dark:text-white/40 text-sm">
                                    尚未指定業主
                                </div>
                            ) : (
                                <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-[50px_1fr_1.5fr_1.8fr_1.2fr_100px] gap-4 px-4 py-3 bg-zinc-50 dark:bg-white/5 text-[10px] font-bold text-zinc-400 dark:text-white/30 uppercase tracking-widest border-b border-zinc-200 dark:border-white/10">
                                        <div>序號</div>
                                        <div>物業名稱</div>
                                        <div>承租人</div>
                                        <div>租期及位置</div>
                                        <div className="text-right">每月租金</div>
                                        <div className="text-center">操作</div>
                                    </div>
                                    {/* Table Rows */}
                                    {formData.proprietorIds.map((propId, index) => {
                                        const selectedProprietor = proprietorsList.find(p => p.id === propId);
                                        const rent = rents.find(r => r.proprietorId === propId);
                                        const isEditing = editingRentId === propId;

                                        if (!selectedProprietor) return null;

                                        // Display data
                                        const tenant = rent?.tenantId ? proprietors?.find(p => p.id === rent.tenantId) : null;
                                        const startDate = rent?.rentOutStartDate ? new Date(rent.rentOutStartDate) : null;
                                        const endDate = rent?.rentOutEndDate ? new Date(rent.rentOutEndDate) : null;
                                        const monthlyRent = rent?.rentOutMonthlyRental || 0;
                                        const location = rent?.rentOutAddressDetail || '-';

                                        return (
                                            <div key={propId} className={`grid grid-cols-[50px_1fr_1.5fr_1.8fr_1.2fr_100px] gap-4 px-4 py-4 border-b border-zinc-100 dark:border-white/5 text-sm hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-colors items-center last:border-0 ${isEditing ? 'bg-purple-500/[0.03] ring-1 ring-purple-500/20' : ''}`}>
                                                {/* No. */}
                                                <div className="text-zinc-400 dark:text-white/20 font-mono text-[11px] font-bold">
                                                    {String(index + 1).padStart(2, '0')}
                                                </div>

                                                {/* Property */}
                                                <div className="font-medium text-zinc-900 dark:text-white truncate" title={formData.name}>
                                                    {formData.name}
                                                </div>

                                                {/* Tenant */}
                                                <div>
                                                    {isEditing ? (
                                                        <select
                                                            value={tempRentData.tenantId || ''}
                                                            onChange={(e) => setTempRentData(prev => ({ ...prev, tenantId: e.target.value }))}
                                                            className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-lg text-xs focus:ring-2 focus:ring-purple-500/30 transition-all shadow-sm"
                                                        >
                                                            <option value="">選擇承租人...</option>
                                                            {(proprietors || []).filter(p => p.code?.startsWith('T')).map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="text-zinc-600 dark:text-white/70">{tenant?.name || '-'}</span>
                                                    )}
                                                </div>

                                                {/* Term & Location */}
                                                <div className="text-xs space-y-1">
                                                    {isEditing ? (
                                                        <div className="space-y-1">
                                                            <div className="flex gap-1 items-center">
                                                                <input
                                                                    type="date"
                                                                    value={tempRentData.rentOutStartDate ? new Date(tempRentData.rentOutStartDate).toISOString().split('T')[0] : ''}
                                                                    onChange={(e) => setTempRentData(prev => ({ ...prev, rentOutStartDate: new Date(e.target.value) }))}
                                                                    className="w-full px-1 py-0.5 bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/20 rounded-md"
                                                                />
                                                                <span>~</span>
                                                                <input
                                                                    type="date"
                                                                    value={tempRentData.rentOutEndDate ? new Date(tempRentData.rentOutEndDate).toISOString().split('T')[0] : ''}
                                                                    onChange={(e) => setTempRentData(prev => ({ ...prev, rentOutEndDate: new Date(e.target.value) }))}
                                                                    className="w-full px-1 py-0.5 bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/20 rounded-md"
                                                                />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={tempRentData.rentOutAddressDetail || ''}
                                                                onChange={(e) => setTempRentData(prev => ({ ...prev, rentOutAddressDetail: e.target.value }))}
                                                                placeholder="地點..."
                                                                className="w-full px-2 py-1 bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/20 rounded-md text-[10px]"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="text-zinc-400 dark:text-white/40">
                                                                {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString() || '至今'}
                                                            </div>
                                                            <div className="text-zinc-600 dark:text-white/70 truncate" title={location}>
                                                                {location}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Rent */}
                                                <div className="text-right">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <span className="text-[10px] text-zinc-400">$</span>
                                                            <input
                                                                type="number"
                                                                value={tempRentData.rentOutMonthlyRental || 0}
                                                                onChange={(e) => setTempRentData(prev => ({ ...prev, rentOutMonthlyRental: parseFloat(e.target.value) }))}
                                                                className="w-20 px-1 py-0.5 bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/20 rounded-md text-right text-xs"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="font-medium text-zinc-900 dark:text-white">
                                                            ${monthlyRent.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center justify-center gap-1">
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveInlineRent(propId)}
                                                                className="p-1 px-2 text-[10px] bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                                            >
                                                                儲存
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingRentId(null)}
                                                                className="p-1 px-2 text-[10px] bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-white/60 rounded-md hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors"
                                                            >
                                                                取消
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {rent ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartInlineEdit(propId, rent)}
                                                                    className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors border border-blue-100 dark:border-none"
                                                                >
                                                                    更改
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-400">尚未建立租約</span>
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
                                                        </>
                                                    )}
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
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">出租記錄</label>
                                {isAuthenticated && (
                                    <button
                                        type="button"
                                        onClick={() => setShowRentModal(true)}
                                        className="px-3 py-1.5 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/30 transition-colors border border-purple-100 dark:border-none text-sm"
                                    >
                                        + 新增租金
                                    </button>
                                )}
                            </div>

                            {/* Select to link existing rent records */}
                            <AnimatedSelect
                                value=""
                                onChange={async (selectedRentId) => {
                                    if (selectedRentId && property?.id) {
                                        const success = await updateRent(selectedRentId, { propertyId: property.id });
                                        if (success) {
                                            queryClient.invalidateQueries({ queryKey: ['rents'] });
                                            addNotification('租金記錄已連結 / Rent record linked', 'update');
                                        }
                                    }
                                }}
                                options={[
                                    { value: '', label: '選擇現有租金記錄以連結...' },
                                    ...(allRents || [])
                                        .filter(r => !r.propertyId || r.propertyId === '')
                                        .map(r => {
                                            const monthlyRent = r.type === 'rent_out' ? r.rentOutMonthlyRental : r.rentingMonthlyRental;
                                            const tenantName = (proprietors || []).find(p => p.id === r.tenantId)?.name;
                                            return {
                                                value: r.id!,
                                                label: `${r.type === 'rent_out' ? '收租' : '交租'} - ${tenantName || '未指定'} - $${(monthlyRent || 0).toLocaleString()}/月`
                                            };
                                        })
                                ]}
                                placeholder="選擇現有租金記錄以連結..."
                            />

                            {rents.length === 0 ? (
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-xl text-center text-zinc-400 dark:text-white/40 text-sm">
                                    尚無租金記錄
                                </div>
                            ) : (
                                <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-[100px_1fr_1.5fr_1.2fr_1fr_90px] gap-4 px-4 py-3 bg-zinc-50 dark:bg-white/5 text-xs font-semibold text-zinc-500 dark:text-white/40 uppercase tracking-wider border-b border-zinc-200 dark:border-white/10 uppercase">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1 h-1 bg-purple-500 rounded-full"></span>編號
                                        </div>
                                        <div>承租人</div>
                                        <div>租借位置</div>
                                        <div>租期</div>
                                        <div className="text-right">租金/月</div>
                                        <div className="text-center">操作</div>
                                    </div>
                                    {/* Table Rows */}
                                    {rents.map((rent, index) => {
                                        // Find either the tenant or the proprietor as the other party
                                        const otherParty = (proprietors || []).find(p => p.id === (rent.tenantId || rent.proprietorId));

                                        // Handle both new and legacy rent data formats
                                        const startDate = rent.type === 'rent_out'
                                            ? (rent.rentOutStartDate ? new Date(rent.rentOutStartDate) : null)
                                            : (rent.rentingStartDate ? new Date(rent.rentingStartDate) : (rent.startDate ? new Date(rent.startDate) : null));
                                        const endDate = rent.type === 'rent_out'
                                            ? (rent.rentOutEndDate ? new Date(rent.rentOutEndDate) : null)
                                            : (rent.rentingEndDate ? new Date(rent.rentingEndDate) : (rent.endDate ? new Date(rent.endDate) : null));
                                        const monthlyRent = rent.type === 'rent_out'
                                            ? (rent.rentOutMonthlyRental || rent.amount || 0)
                                            : (rent.rentingMonthlyRental || rent.amount || 0);

                                        const months = startDate && endDate
                                            ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
                                            : (rent.type === 'rent_out' ? rent.rentOutPeriods : rent.rentingPeriods) || 0;

                                        // Use actual contract number instead of auto-generated code
                                        const contractNumber = rent.type === 'rent_out'
                                            ? (rent.rentOutTenancyNumber || `-`)
                                            : (rent.rentingNumber || `-`);

                                        // Check if rent is expired
                                        const isExpired = endDate ? endDate < new Date() : false;


                                        return (
                                            <div key={rent.id} className={`grid grid-cols-[100px_1fr_1.5fr_1.2fr_1fr_90px] gap-4 px-4 py-4 border-b border-zinc-100 dark:border-white/5 text-sm hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors items-center last:border-0 group ${isExpired ? 'bg-red-50/50 dark:bg-red-500/5' : ''}`}>
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-[11px] font-bold text-zinc-400 dark:text-white/30 tracking-tight">{contractNumber}</span>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full w-fit font-bold tracking-wider ${rent.type === 'rent_out'
                                                            ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20'
                                                            : 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20'}`}>
                                                            {rent.type === 'rent_out' ? '收租' : '交租'}
                                                        </span>
                                                        {isExpired && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full w-fit font-bold tracking-wider bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-500/30">
                                                                已過期
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                                        {otherParty?.name || '-'}
                                                    </span>
                                                    {otherParty?.shortName && (
                                                        <span className="text-[10px] text-zinc-400 dark:text-white/30 truncate uppercase">
                                                            {otherParty.shortName}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-zinc-600 dark:text-white/70 text-xs leading-relaxed line-clamp-2">
                                                    {rent.location || rent.rentOutAddressDetail || '-'}
                                                </div>
                                                <div className="flex flex-col">
                                                    {startDate ? (
                                                        <>
                                                            <div className="text-zinc-700 dark:text-white/90 font-medium tabular-nums text-xs">
                                                                {startDate.toLocaleDateString('zh-TW')}
                                                            </div>
                                                            <div className="text-zinc-400 dark:text-white/30 flex items-center gap-1 tabular-nums text-xs">
                                                                <span className="opacity-50">~</span> {endDate ? endDate.toLocaleDateString('zh-TW') : '-'}
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-1">
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-white/10 rounded font-bold text-zinc-500 dark:text-white/40">
                                                                    {months}個月
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-zinc-300 dark:text-white/10 italic text-xs">未設定</span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-zinc-400 dark:text-white/30 font-bold uppercase tracking-widest">{rent.currency || 'HKD'}</span>
                                                        <span className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                                                            ${monthlyRent.toLocaleString()}
                                                            <span className="text-[10px] text-zinc-400 dark:text-white/30 ml-1">/月</span>
                                                        </span>
                                                    </div>
                                                </div>
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
                                                        onClick={() => handleDeleteRent(rent.id!)}
                                                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-all"
                                                        title="刪除租金記錄"
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
                    mode={proprietorModalMode}
                    onClose={() => setShowProprietorModal(false)}
                    onSuccess={handleProprietorCreated}
                />
            )}

            {/* Rent Modal */}
            {showRentModal && property?.id && (
                <RentModal
                    propertyId={property.id}
                    onClose={() => setShowRentModal(false)}
                    onSuccess={handleRentCreated}
                />
            )}

            {/* Edit Rent Modal */}
            {editingRent && (
                <RentModal
                    propertyId={property?.id}
                    rent={editingRent}
                    onClose={() => setEditingRent(null)}
                    onSuccess={() => {
                        setEditingRent(null);
                        queryClient.invalidateQueries({ queryKey: ['rents'] });
                        addNotification('租金記錄已更新', 'update');
                    }}
                />
            )}
        </>
    );
}
