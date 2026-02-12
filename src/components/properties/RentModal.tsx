'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRents, useProprietors, useProperties } from '@/hooks/useStorage';
import type { Proprietor, Property, Rent } from '@/lib/db';
import ProprietorModal from '@/components/properties/ProprietorModal';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[150px] w-full bg-zinc-100 dark:bg-white/5 animate-pulse rounded-xl" />
});

interface RentModalProps {
    propertyId?: string;
    rent?: Rent | null; // For editing existing rent
    onClose: () => void;
    onSuccess: (rentId: string) => void;
}

const rentTypes = [
    { value: 'rent_out', label: '收租' },
    { value: 'renting', label: '交租' },
];

const rentOutStatuses = [
    { value: 'listing', label: '放盤中' },
    { value: 'renting', label: '出租中' },
    { value: 'completed', label: '已完租' },
];

export default function RentModal({ propertyId, rent, onClose, onSuccess }: RentModalProps) {
    const { addRent, updateRent } = useRents();
    const { getProprietors } = useProprietors();
    const { getProperties } = useProperties();
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState('');
    const [proprietors, setProprietors] = useState<Proprietor[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [showProprietorModal, setShowProprietorModal] = useState(false);

    const [formData, setFormData] = useState(() => {
        // Helper function to format date for input
        const formatDate = (date: any) => {
            if (!date) return '';
            const d = new Date(date);
            return d.toISOString().split('T')[0];
        };

        if (rent) {
            // Edit mode - populate with existing data
            return {
                type: rent.type || 'rent_out' as 'rent_out' | 'renting',
                propertyId: rent.propertyId || propertyId || '',
                tenantId: rent.tenantId || '',
                // Rent Out Fields
                rentOutTenancyNumber: rent.rentOutTenancyNumber || '',
                rentOutPricing: rent.rentOutPricing?.toString() || '',
                rentOutMonthlyRental: rent.rentOutMonthlyRental?.toString() || '',
                rentOutPeriods: rent.rentOutPeriods?.toString() || '',
                rentOutTotalAmount: rent.rentOutTotalAmount?.toString() || '',
                rentOutStartDate: formatDate(rent.rentOutStartDate),
                rentOutEndDate: formatDate(rent.rentOutEndDate),
                rentOutActualEndDate: formatDate(rent.rentOutActualEndDate),
                rentOutDepositReceived: rent.rentOutDepositReceived?.toString() || '',
                rentOutDepositReceiveDate: formatDate(rent.rentOutDepositReceiveDate),
                rentOutDepositReturnDate: formatDate(rent.rentOutDepositReturnDate),
                rentOutDepositReturnAmount: rent.rentOutDepositReturnAmount?.toString() || '',
                rentOutLessor: rent.rentOutLessor || '',
                rentOutAddressDetail: rent.rentOutAddressDetail || '',
                rentOutStatus: rent.rentOutStatus || 'listing' as 'listing' | 'renting' | 'completed',
                rentOutDescription: rent.rentOutDescription || '',
                // Renting Fields
                rentingNumber: rent.rentingNumber || '',
                rentingReferenceNumber: rent.rentingReferenceNumber || '',
                rentingMonthlyRental: rent.rentingMonthlyRental?.toString() || '',
                rentingPeriods: rent.rentingPeriods?.toString() || '',
                rentingStartDate: formatDate(rent.rentingStartDate),
                rentingEndDate: formatDate(rent.rentingEndDate),
                rentingDeposit: rent.rentingDeposit?.toString() || '',
            };
        }

        // Create mode - empty form
        return {
            type: 'rent_out' as 'rent_out' | 'renting',
            propertyId: propertyId || '',
            tenantId: '',
            rentOutTenancyNumber: '',
            rentOutPricing: '',
            rentOutMonthlyRental: '',
            rentOutPeriods: '',
            rentOutTotalAmount: '',
            rentOutStartDate: '',
            rentOutEndDate: '',
            rentOutActualEndDate: '',
            rentOutDepositReceived: '',
            rentOutDepositReceiveDate: '',
            rentOutDepositReturnDate: '',
            rentOutDepositReturnAmount: '',
            rentOutLessor: '',
            rentOutAddressDetail: '',
            rentOutStatus: 'listing' as 'listing' | 'renting' | 'completed',
            rentOutDescription: '',
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleProprietorCreated = async (id: string) => {
        await loadData();
        setFormData(prev => ({ ...prev, tenantId: id }));
        setShowProprietorModal(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const baseData = {
                propertyId: formData.propertyId,
                tenantId: formData.tenantId,
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
                    rentOutDepositReceiveDate: formData.rentOutDepositReceiveDate ? new Date(formData.rentOutDepositReceiveDate) : undefined,
                    rentOutDepositReturnDate: formData.rentOutDepositReturnDate ? new Date(formData.rentOutDepositReturnDate) : undefined,
                    rentOutDepositReturnAmount: parseFloat(formData.rentOutDepositReturnAmount) || undefined,
                    rentOutLessor: formData.rentOutLessor,
                    rentOutAddressDetail: formData.rentOutAddressDetail,
                    rentOutStatus: formData.rentOutStatus,
                    rentOutDescription: formData.rentOutDescription,
                };
            } else {
                rentData = {
                    ...rentData,
                    rentingNumber: formData.rentingNumber,
                    rentingReferenceNumber: formData.rentingReferenceNumber,
                    rentingMonthlyRental: parseFloat(formData.rentingMonthlyRental) || undefined,
                    rentingPeriods: parseInt(formData.rentingPeriods) || undefined,
                    rentingStartDate: formData.rentingStartDate ? new Date(formData.rentingStartDate) : undefined,
                    rentingEndDate: formData.rentingEndDate ? new Date(formData.rentingEndDate) : undefined,
                    rentingDeposit: parseFloat(formData.rentingDeposit) || undefined,
                };
            }

            // Edit or create based on whether rent prop exists
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
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {rent ? (
                                formData.type === 'rent_out' ? '編輯出租合約 (收租)' : '編輯租賃合約 (交租)'
                            ) : (
                                formData.type === 'rent_out' ? '新增出租合約 (收租)' : '新增租賃合約 (交租)'
                            )}
                        </h2>
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
                    <div className="space-y-2">
                        <label className={labelClass}>類型 *</label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            required
                            className={inputClass}
                        >
                            {rentTypes.map(t => (
                                <option key={t.value} value={t.value} className="bg-white dark:bg-[#1a1a2e]">{t.label}</option>
                            ))}
                        </select>
                    </div>

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
                                    {properties.map(p => (
                                        <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">{p.name} ({p.code})</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>承租人</label>
                            <div className="flex gap-2">
                                {loadingData ? (
                                    <div className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl flex items-center gap-2">
                                        <motion.div
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                            className="w-4 h-4 rounded-full bg-purple-500"
                                        />
                                        <span className="text-zinc-400 dark:text-white/40">載入中...</span>
                                    </div>
                                ) : (
                                    <select
                                        name="tenantId"
                                        value={formData.tenantId}
                                        onChange={handleChange}
                                        className={`${inputClass} flex-1`}
                                    >
                                        <option value="" className="bg-white dark:bg-[#1a1a2e]">選擇承租人...</option>
                                        {proprietors
                                            .filter(p => p.code?.startsWith('T'))
                                            .map(p => (
                                                <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a2e]">{p.name}</option>
                                            ))}
                                    </select>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowProprietorModal(true)}
                                    className="px-4 py-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/30 transition-all border border-purple-100 dark:border-white/10 text-sm font-medium h-[42px] whitespace-nowrap"
                                >
                                    + 新增
                                </button>
                            </div>
                        </div>
                    </div>

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
                                    <input type="number" name="rentOutPricing" value={formData.rentOutPricing} onChange={handleChange} className={inputClass} placeholder="0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約月租 *</label>
                                    <input type="number" name="rentOutMonthlyRental" value={formData.rentOutMonthlyRental} onChange={handleChange} required className={inputClass} placeholder="50000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約期數 (月)</label>
                                    <input type="number" name="rentOutPeriods" value={formData.rentOutPeriods} onChange={handleChange} className={inputClass} placeholder="12" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>出租合約總額</label>
                                <input type="number" name="rentOutTotalAmount" value={formData.rentOutTotalAmount} onChange={handleChange} className={inputClass} placeholder="600000" />
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
                                    <input type="number" name="rentOutDepositReceived" value={formData.rentOutDepositReceived} onChange={handleChange} className={inputClass} placeholder="100000" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>按金收取日期</label>
                                    <input type="date" name="rentOutDepositReceiveDate" value={formData.rentOutDepositReceiveDate} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>按金退回日期</label>
                                    <input type="date" name="rentOutDepositReturnDate" value={formData.rentOutDepositReturnDate} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>按金退回金額</label>
                                    <input type="number" name="rentOutDepositReturnAmount" value={formData.rentOutDepositReturnAmount} onChange={handleChange} className={inputClass} placeholder="100000" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>出租合約出租人</label>
                                    <input type="text" name="rentOutLessor" value={formData.rentOutLessor} onChange={handleChange} className={inputClass} placeholder="公司名稱 / 個人名稱" />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>地址資料</label>
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
                                    <input type="number" name="rentingMonthlyRental" value={formData.rentingMonthlyRental} onChange={handleChange} className={inputClass} placeholder="30000" />
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

                            <div className="space-y-2">
                                <label className={labelClass}>押金</label>
                                <input type="number" name="rentingDeposit" value={formData.rentingDeposit} onChange={handleChange} className={inputClass} placeholder="60000" />
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

            {/* Proprietor Modal for creating new tenant */}
            {showProprietorModal && (
                <ProprietorModal
                    mode="tenant"
                    onClose={() => setShowProprietorModal(false)}
                    onSuccess={handleProprietorCreated}
                />
            )}
        </>
    );
}
