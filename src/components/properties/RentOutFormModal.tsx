'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatNumberWithCommas, normalizeDuplicateName, parsePriceInput } from '@/lib/formatters';
import { RENT_OUT_CONTRACT_STATUS_OPTIONS } from '@/lib/rentPaymentDisplay';
import type { SubLandlord, CurrentTenant } from '@/lib/db';
import { fetchCurrentTenants, fetchSubLandlords, useSubLandlords, useCurrentTenants } from '@/hooks/useStorage';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[120px] w-full bg-zinc-100 dark:bg-white/5 animate-pulse rounded-xl" />,
});

type FormData = {
    name: string;
    tenancyNumber: string;
    pricing: string;
    monthlyRental: string;
    periods: string;
    totalAmount: string;
    startDate: string;
    endDate: string;
    actualEndDate: string;
    depositReceived: string;
    depositReceiptNumber: string;
    depositReceiveDate: string;
    depositReturnDate: string;
    depositReturnAmount: string;
    lessor: string;
    addressDetail: string;
    status: 'listing' | 'renting' | 'leasing_in' | 'completed';
    description: string;
};

interface RentOutFormModalProps {
    mode: 'sub_landlord' | 'current_tenant';
    editItem?: SubLandlord | CurrentTenant | null;
    /** 是否为已有二房东添加新物业数据模式 */
    isAddPropertyData?: boolean;
    /** 当前物业编号（用于自动生成出租号码） */
    currentPropertyCode?: string;
    onClose: () => void;
    onSuccess: (id: string) => void;
}

const formatDate = (d: any) => {
    if (!d) return '';
    const x = new Date(d);
    return x.toISOString().split('T')[0];
};

export default function RentOutFormModal({ mode, editItem, isAddPropertyData = false, currentPropertyCode, onClose, onSuccess }: RentOutFormModalProps) {
    const { addSubLandlord, updateSubLandlord } = useSubLandlords();
    const { addCurrentTenant, updateCurrentTenant } = useCurrentTenants();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<FormData>(() => {
        // 如果是为已有二房东添加新物业数据模式
        if (isAddPropertyData && editItem) {
            // 表单中只显示当前物业编号（不显示后缀）
            let newTenancyNumber = currentPropertyCode || '';
            
            return {
                name: editItem.name || '', // 名称保持，但只读
                tenancyNumber: newTenancyNumber,
                pricing: '', // 新物业数据，字段为空
                monthlyRental: '',
                periods: '',
                totalAmount: '',
                startDate: '',
                endDate: '',
                actualEndDate: '',
                depositReceived: '',
                depositReceiptNumber: '',
                depositReceiveDate: '',
                depositReturnDate: '',
                depositReturnAmount: '',
                lessor: '',
                addressDetail: '',
                status: 'listing' as const,
                description: '',
            };
        }
        
        if (editItem) {
            return {
                name: editItem.name || '',
                tenancyNumber: editItem.tenancyNumber || '',
                pricing: editItem.pricing?.toString() || '',
                monthlyRental: editItem.monthlyRental?.toString() || '',
                periods: editItem.periods?.toString() || '',
                totalAmount: editItem.totalAmount?.toString() || '',
                startDate: formatDate(editItem.startDate),
                endDate: formatDate(editItem.endDate),
                actualEndDate: formatDate(editItem.actualEndDate),
                depositReceived: editItem.depositReceived?.toString() || '',
                depositReceiptNumber: editItem.depositReceiptNumber || '',
                depositReceiveDate: formatDate(editItem.depositReceiveDate),
                depositReturnDate: formatDate(editItem.depositReturnDate),
                depositReturnAmount: editItem.depositReturnAmount?.toString() || '',
                lessor: editItem.lessor || '',
                addressDetail: editItem.addressDetail || '',
                status: (editItem.status as any) || 'listing',
                description: editItem.description || '',
            };
        }
        return {
            name: '',
            tenancyNumber: '',
            pricing: '',
            monthlyRental: '',
            periods: '',
            totalAmount: '',
            startDate: '',
            endDate: '',
            actualEndDate: '',
            depositReceived: '',
            depositReceiptNumber: '',
            depositReceiveDate: '',
            depositReturnDate: '',
            depositReturnAmount: '',
            lessor: '',
            addressDetail: '',
            status: 'listing' as const,
            description: '',
        };
    });

    useEffect(() => {
        const monthly = parseFloat(formData.monthlyRental);
        const periods = parseInt(formData.periods);
        const newTotal = !isNaN(monthly) && !isNaN(periods) ? (monthly * periods).toString() : '';
        if (formData.totalAmount !== newTotal) {
            setFormData(prev => ({ ...prev, totalAmount: newTotal }));
        }
    }, [formData.monthlyRental, formData.periods]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'name') setError('');
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePriceChange = (name: keyof FormData, value: string) => {
        const parsed = parsePriceInput(value);
        setFormData(prev => ({ ...prev, [name]: parsed }));
    };

    const buildPayload = (): Omit<SubLandlord, 'id' | 'createdAt' | 'updatedAt'> => ({
        name: formData.name.trim(),
        tenancyNumber: formData.tenancyNumber || undefined,
        pricing: parseFloat(formData.pricing) || undefined,
        monthlyRental: parseFloat(formData.monthlyRental) || undefined,
        periods: parseInt(formData.periods) || undefined,
        totalAmount: parseFloat(formData.totalAmount) || undefined,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        actualEndDate: formData.actualEndDate ? new Date(formData.actualEndDate) : undefined,
        depositReceived: parseFloat(formData.depositReceived) || undefined,
        depositReceiptNumber: formData.depositReceiptNumber || undefined,
        depositReceiveDate: formData.depositReceiveDate ? new Date(formData.depositReceiveDate) : undefined,
        depositReturnDate: formData.depositReturnDate ? new Date(formData.depositReturnDate) : undefined,
        depositReturnAmount: parseFloat(formData.depositReturnAmount) || undefined,
        lessor: formData.lessor || undefined,
        addressDetail: formData.addressDetail || undefined,
        status: formData.status,
        description: formData.description || undefined,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('請輸入名稱');
            return;
        }

        const nameNorm = normalizeDuplicateName(formData.name);
        if (!isAddPropertyData) {
            try {
                const list =
                    mode === 'sub_landlord' ? await fetchSubLandlords() : await fetchCurrentTenants();
                if (editItem?.id) {
                    const dup = list.some(
                        x =>
                            x.id !== editItem.id &&
                            normalizeDuplicateName(x.name || '') === nameNorm
                    );
                    if (dup) {
                        setError('已有相同名稱，請使用其他名稱');
                        return;
                    }
                } else {
                    const dup = list.some(x => normalizeDuplicateName(x.name || '') === nameNorm);
                    if (dup) {
                        setError('已有相同名稱，請使用其他名稱');
                        return;
                    }
                }
            } catch {
                setError('無法驗證名稱，請稍後再試');
                return;
            }
        }

        setSaving(true);
        setError('');
        try {
            let payload = buildPayload();
            
            // 如果是为已有二房东添加新物业数据，需要将当前物业编号追加到原有号码后面
            if (isAddPropertyData && editItem?.id && mode === 'sub_landlord') {
                // 名称保持不变
                payload.name = editItem.name;
                
                // 获取当前输入的物业编号（表单中只显示当前物业编号，如 A01-P008）
                const currentPropertyCodeOnly = formData.tenancyNumber.trim();
                
                if (!currentPropertyCodeOnly) {
                    // 如果没有输入，保持原有号码
                    payload.tenancyNumber = editItem.tenancyNumber;
                } else if (editItem.tenancyNumber && editItem.tenancyNumber.trim()) {
                    // 检查是否已经包含该物业编号，避免重复
                    const existingParts = editItem.tenancyNumber.split(',').map(p => p.trim());
                    
                    // 提取当前输入的物业编号（可能是完整格式如A01-P008，或短格式如C33）
                    const currentCode = currentPropertyCodeOnly;
                    const currentCodePrefix = currentCode.split('-')[0]; // 提取前缀部分
                    
                    // 检查原有号码中是否已包含该物业编号
                    const alreadyExists = existingParts.some(part => {
                        // 提取每个部分的物业编号
                        const partFirstDash = part.indexOf('-');
                        if (partFirstDash > 0) {
                            const afterDash = part.substring(partFirstDash + 1);
                            // 如果是后缀格式（如ER033），提取前面部分
                            if (afterDash.match(/^[A-Z]{2,3}\d+$/)) {
                                const partCode = part.substring(0, partFirstDash);
                                return partCode === currentCodePrefix || currentCode.startsWith(partCode + '-');
                            } else {
                                // 完整物业编号格式
                                return part === currentCode || part.startsWith(currentCodePrefix + '-');
                            }
                        } else {
                            return part === currentCodePrefix;
                        }
                    });
                    
                    if (!alreadyExists) {
                        // 追加新物业编号到原有号码后面
                        payload.tenancyNumber = `${editItem.tenancyNumber}, ${currentPropertyCodeOnly}`;
                    } else {
                        // 如果已存在，保持原有号码
                        payload.tenancyNumber = editItem.tenancyNumber;
                    }
                } else {
                    // 如果没有原有号码，使用当前输入的
                    payload.tenancyNumber = currentPropertyCodeOnly;
                }
            }
            
            if (editItem?.id) {
                if (mode === 'sub_landlord') {
                    const ok = await updateSubLandlord(editItem.id, payload);
                    if (ok) onSuccess(editItem.id);
                    else setError('更新失敗');
                } else {
                    const ok = await updateCurrentTenant(editItem.id, payload);
                    if (ok) onSuccess(editItem.id);
                    else setError('更新失敗');
                }
            } else {
                if (mode === 'sub_landlord') {
                    const id = await addSubLandlord(payload);
                    if (id) onSuccess(id);
                    else setError('新增失敗');
                } else {
                    const id = await addCurrentTenant(payload);
                    if (id) onSuccess(id);
                    else setError('新增失敗');
                }
            }
        } catch (err) {
            setError('操作失敗');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = 'w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all';
    const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-white/80 mb-1';

    const title = mode === 'sub_landlord'
        ? (isAddPropertyData ? '新增二房東資料' : (editItem ? '編輯二房東' : '新增二房東'))
        : (editItem ? '編輯現時租客' : '新增現時租客');

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[90vh] overflow-hidden bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-[70] flex flex-col"
            >
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-600 dark:text-red-200 text-sm">{error}</div>
                        )}
                        <div className="space-y-2">
                            <label className={labelClass}>名稱 *</label>
                            <input 
                                type="text" 
                                name="name" 
                                value={formData.name} 
                                onChange={handleChange} 
                                required 
                                disabled={isAddPropertyData}
                                className={`${inputClass} ${isAddPropertyData ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder={mode === 'sub_landlord' ? '二房東名稱' : '租客名稱'} 
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClass}>出租號碼</label>
                                <input type="text" name="tenancyNumber" value={formData.tenancyNumber} onChange={handleChange} className={inputClass} placeholder="RO-001" />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>出租放盤價</label>
                                <input type="text" name="pricing" value={formatNumberWithCommas(formData.pricing)} onChange={(e) => handlePriceChange('pricing', e.target.value)} className={inputClass} placeholder="0" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClass}>出租月租</label>
                                <input type="text" name="monthlyRental" value={formatNumberWithCommas(formData.monthlyRental)} onChange={(e) => handlePriceChange('monthlyRental', e.target.value)} className={inputClass} placeholder="50,000" />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>出租期數 (月)</label>
                                <input type="number" name="periods" value={formData.periods} onChange={handleChange} className={inputClass} placeholder="12" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>出租總額</label>
                            <input type="text" value={formatNumberWithCommas(formData.totalAmount)} readOnly className={`${inputClass} bg-zinc-100 dark:bg-white/5 cursor-not-allowed opacity-80`} placeholder="自動計算" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClass}>開始日期</label>
                                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className={inputClass} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>結束日期</label>
                                <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className={inputClass} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>實際結束日期</label>
                            <input type="date" name="actualEndDate" value={formData.actualEndDate} onChange={handleChange} className={inputClass} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClass}>出租按金</label>
                                <input type="text" name="depositReceived" value={formatNumberWithCommas(formData.depositReceived)} onChange={(e) => handlePriceChange('depositReceived', e.target.value)} className={inputClass} placeholder="100,000" />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>按金收據號碼</label>
                                <input type="text" name="depositReceiptNumber" value={formData.depositReceiptNumber} onChange={handleChange} className={inputClass} placeholder="請輸入按金收據號碼" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClass}>按金收取日期</label>
                                <input type="date" name="depositReceiveDate" value={formData.depositReceiveDate} onChange={handleChange} className={inputClass} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>按金退回日期</label>
                                <input type="date" name="depositReturnDate" value={formData.depositReturnDate} onChange={handleChange} className={inputClass} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>按金退回金額</label>
                            <input type="text" name="depositReturnAmount" value={formatNumberWithCommas(formData.depositReturnAmount)} onChange={(e) => handlePriceChange('depositReturnAmount', e.target.value)} className={inputClass} placeholder="100,000" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClass}>出租人</label>
                                <input type="text" name="lessor" value={formData.lessor} onChange={handleChange} className={inputClass} placeholder="公司名稱 / 個人名稱" />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClass}>租借位置 / 地址</label>
                                <input type="text" name="addressDetail" value={formData.addressDetail} onChange={handleChange} className={inputClass} placeholder="詳細地址" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>租務狀態</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                                {RENT_OUT_CONTRACT_STATUS_OPTIONS.map(s => (
                                    <option key={s.value} value={s.value} className="bg-white dark:bg-[#1a1a2e]">{s.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={labelClass}>描述</label>
                            <div className="rich-text-editor">
                                <style jsx global>{`
                                    .rich-text-editor .ql-toolbar { border-radius: 12px 12px 0 0; border-color: var(--border-color); background: var(--bg-color); }
                                    .rich-text-editor .ql-container { border-radius: 0 0 12px 12px; border-color: var(--border-color); background: var(--bg-color); min-height: 100px; }
                                    .rich-text-editor .ql-editor { color: inherit; min-height: 80px; }
                                    :root { --border-color: #e5e7eb; --bg-color: #f9fafb; }
                                    .dark { --border-color: rgba(255,255,255,0.1); --bg-color: rgba(255,255,255,0.05); }
                                `}</style>
                                <ReactQuill
                                    theme="snow"
                                    value={formData.description}
                                    onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                                    placeholder="合約描述或備註..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-100 dark:border-white/5 shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all">
                            取消
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? '處理中...' : (editItem ? '更新' : '新增')}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </>
    );
}
