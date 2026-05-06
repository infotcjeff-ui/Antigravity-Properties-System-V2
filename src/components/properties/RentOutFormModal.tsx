'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatNumberWithCommas, normalizeDuplicateName, parsePriceInput } from '@/lib/formatters';
import { RENT_OUT_CONTRACT_STATUS_OPTIONS } from '@/lib/rentPaymentDisplay';
import type { SubLandlord, CurrentTenant } from '@/lib/db';
import { fetchCurrentTenants, fetchProprietors, fetchSubLandlords, useSubLandlords, useCurrentTenants } from '@/hooks/useStorage';
import dynamic from 'next/dynamic';
import AnimatedSelect from '@/components/ui/AnimatedSelect';
import 'react-quill-new/dist/quill.snow.css';

/** 擁有人類別：與 ProprietorModal 新增業主相同選項與排序 */
const PROPRIETOR_OWNER_CATEGORY_OPTIONS: { value: string; label: string }[] = [
    { value: 'private_individual', label: '個人' },
    { value: 'joint_venture', label: '合資公司' },
    { value: 'private_company', label: '私人公司' },
    { value: 'group_company', label: '集團旗下公司' },
].sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label, 'zh-Hant'));

/** 現時租客表單：租客類別（與業主新增擁有人類別一致，固定排序） */
const CURRENT_TENANT_CATEGORY_OPTIONS: { value: string; label: string }[] = [
    { value: 'private_individual', label: '個人' },
    { value: 'joint_venture', label: '合資公司' },
    { value: 'private_company', label: '私人公司' },
    { value: 'group_company', label: '集團旗下公司' },
];

const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-[120px] w-full bg-zinc-100 dark:bg-white/5 animate-pulse rounded-xl" />,
});

type SubLandlordFormData = {
    name: string;
    code: string;
    brNumber: string;
};

type CurrentTenantFormData = {
    name: string;
    code: string;
    englishName: string;
    shortName: string;
    type: 'company' | 'individual';
    category: string;
    brNumber: string;
    tenancyNumber: string;
};

type FormData = SubLandlordFormData | CurrentTenantFormData;

interface RentOutFormModalProps {
    mode: 'sub_landlord' | 'current_tenant';
    editItem?: SubLandlord | CurrentTenant | null;
    onClose: () => void;
    onSuccess: (id: string) => void;
    /** 取消時回到詳情模式（僅用於現時租客從詳情進入編輯時） */
    onCancel?: () => void;
}

const formatDate = (d: any) => {
    if (!d) return '';
    const x = new Date(d);
    return x.toISOString().split('T')[0];
};

export default function RentOutFormModal({ mode, editItem, onClose, onSuccess, onCancel }: RentOutFormModalProps) {
    const { addSubLandlord, updateSubLandlord } = useSubLandlords();
    const { addCurrentTenant, updateCurrentTenant } = useCurrentTenants();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<FormData>(() => {
        if (mode === 'current_tenant') {
            const ct = editItem as CurrentTenant | null;
            return {
                name: editItem?.name || '',
                code: ct?.code ?? '',
                englishName: ct?.englishName ?? '',
                shortName: ct?.shortName ?? '',
                type: (ct?.type || 'company') as 'company' | 'individual',
                category: ct?.category ?? 'group_company',
                brNumber: ct?.brNumber ?? '',
                tenancyNumber: editItem?.tenancyNumber || '',
            };
        }
        return {
            name: editItem?.name || '',
            code: (editItem as SubLandlord)?.code || '',
            brNumber: (editItem as SubLandlord)?.brNumber || '',
        };
    });

    useEffect(() => {
        if (mode !== 'current_tenant' || editItem) return;
        let cancelled = false;
        (async () => {
            const data = await fetchProprietors(undefined);
            if (cancelled) return;
            const prefix = 'A';
            const sameTypeCount = data.filter(p => p.code?.startsWith(prefix)).length + 1;
            const code = `${prefix}${sameTypeCount.toString().padStart(2, '0')}`;
            setFormData(prev => ({ ...(prev as CurrentTenantFormData), code }));
        })();
        return () => {
            cancelled = true;
        };
    }, [mode, editItem]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'name') setError('');
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const buildContractPayload = (): Omit<SubLandlord, 'id' | 'createdAt' | 'updatedAt'> | Omit<CurrentTenant, 'id' | 'createdAt' | 'updatedAt'> => {
        if (mode === 'current_tenant') {
            const ct = formData as CurrentTenantFormData;
            return {
                name: ct.name.trim(),
                code: ct.code.trim(),
                englishName: ct.englishName.trim(),
                shortName: ct.shortName.trim(),
                type: ct.type,
                category: ct.category as CurrentTenant['category'],
                brNumber: ct.brNumber.trim() || undefined,
                tenancyNumber: ct.tenancyNumber || undefined,
            };
        }
        const sl = formData as SubLandlordFormData;
        return {
            name: sl.name.trim(),
            code: sl.code.trim() || undefined,
            brNumber: sl.brNumber.trim() || undefined,
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError(mode === 'current_tenant' ? '請輸入租客名稱' : '請輸入名稱');
            return;
        }

        const nameNorm = normalizeDuplicateName(formData.name);
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

        setSaving(true);
        setError('');
        try {
            const payload = buildContractPayload();

            if (editItem?.id) {
                if (mode === 'sub_landlord') {
                    const ok = await updateSubLandlord(editItem.id, payload as Omit<SubLandlord, 'id' | 'createdAt' | 'updatedAt'>);
                    if (ok) onSuccess(editItem.id);
                    else setError('更新失敗');
                } else {
                    const ok = await updateCurrentTenant(editItem.id, payload as Omit<CurrentTenant, 'id' | 'createdAt' | 'updatedAt'>);
                    if (ok) onSuccess(editItem.id);
                    else setError('更新失敗');
                }
            } else {
                if (mode === 'sub_landlord') {
                    const id = await addSubLandlord(payload as Omit<SubLandlord, 'id' | 'createdAt' | 'updatedAt'>);
                    if (id) onSuccess(id);
                    else setError('新增失敗');
                } else {
                    const id = await addCurrentTenant(payload as Omit<CurrentTenant, 'id' | 'createdAt' | 'updatedAt'>);
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

    const inputClass =
        'w-full min-h-12 px-4 py-3.5 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all';
    const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-white/80 mb-1';

    const title = mode === 'sub_landlord'
        ? (editItem ? '編輯二房東' : '新增二房東')
        : (editItem ? '編輯現時租客' : '新增現時租客');

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl min-h-[min(480px,88vh)] max-h-[94vh] overflow-hidden bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-[70] flex flex-col"
            >
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-600 dark:text-red-200 text-sm">{error}</div>
                        )}
                        {mode === 'current_tenant' ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelClass}>租客名稱 *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className={inputClass}
                                            placeholder="請輸入租客名稱"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>公司名稱</label>
                                        <input
                                            type="text"
                                            name="englishName"
                                            value={(formData as CurrentTenantFormData).englishName}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="例如: CITIC (HK) Investment Ltd"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelClass}>租客代碼</label>
                                        <input
                                            type="text"
                                            name="code"
                                            value={(formData as CurrentTenantFormData).code}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="例如: A01"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>BR Number</label>
                                        <input
                                            type="text"
                                            name="brNumber"
                                            value={(formData as CurrentTenantFormData).brNumber}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="請輸入 BR Number"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelClass}>業主性質</label>
                                        <AnimatedSelect
                                            name="type"
                                            value={(formData as CurrentTenantFormData).type}
                                            onChange={(value) =>
                                                handleChange({ target: { name: 'type', value } } as React.ChangeEvent<HTMLInputElement>)
                                            }
                                            options={[
                                                { value: 'company', label: '公司' },
                                                { value: 'individual', label: '個人' },
                                            ]}
                                            placeholder="選擇性質"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>租客類別</label>
                                        <AnimatedSelect
                                            name="category"
                                            value={(formData as CurrentTenantFormData).category}
                                            onChange={(value) =>
                                                handleChange({ target: { name: 'category', value } } as React.ChangeEvent<HTMLInputElement>)
                                            }
                                            options={CURRENT_TENANT_CATEGORY_OPTIONS}
                                            placeholder="選擇類別"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>出租號碼</label>
                                    <input
                                        type="text"
                                        name="tenancyNumber"
                                        value={(formData as CurrentTenantFormData).tenancyNumber}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="RO-001"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelClass}>名稱 *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className={inputClass}
                                            placeholder="二房東名稱"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>二房東代碼</label>
                                        <input
                                            type="text"
                                            name="code"
                                            value={(formData as SubLandlordFormData).code}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="例如: SL01"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>BR Number</label>
                                    <input
                                        type="text"
                                        name="brNumber"
                                        value={(formData as SubLandlordFormData).brNumber}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="請輸入 BR Number"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-100 dark:border-white/5 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                if (editItem && onCancel) {
                                    onCancel();
                                } else {
                                    onClose();
                                }
                            }}
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
                            {saving ? '處理中...' : (editItem ? '更新' : '新增')}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </>
    );
}
