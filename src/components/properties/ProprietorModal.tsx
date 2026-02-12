import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useProprietors } from '@/hooks/useStorage';
import { type Proprietor } from '@/lib/db';
import AnimatedSelect from '../ui/AnimatedSelect';

interface ProprietorModalProps {
    onClose: () => void;
    onSuccess: (proprietorId: string) => void;
    mode?: 'proprietor' | 'tenant';
    initialData?: Proprietor | null;
}

export default function ProprietorModal({ onClose, onSuccess, mode = 'proprietor', initialData }: ProprietorModalProps) {
    const { getProprietors, addProprietor, updateProprietor, loading } = useProprietors();
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(!initialData);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        code: initialData?.code || '',
        type: (initialData?.type || 'company') as 'company' | 'individual',
        category: (initialData?.category || (mode === 'tenant' ? 'external_customer' : 'group_company')) as any,
        englishName: initialData?.englishName || '',
        shortName: initialData?.shortName || '',
        description: (initialData as any)?.description || '',
    });

    // Auto-generate code based on mode (T for tenants, A for proprietors) - only for new records
    useEffect(() => {
        if (initialData) return;

        const generateCode = async () => {
            const data = await getProprietors();
            const prefix = mode === 'tenant' ? 'T' : 'A';
            // Count only items with matching prefix to get independent numbering
            const sameTypeCount = data.filter(p => p.code?.startsWith(prefix)).length + 1;
            const code = `${prefix}${sameTypeCount.toString().padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, code }));
        };
        generateCode();
    }, [getProprietors, mode, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            if (initialData?.id) {
                // Update existing
                const success = await updateProprietor(initialData.id, formData);
                if (success) {
                    onSuccess(initialData.id);
                } else {
                    setError('更新失敗');
                }
            } else {
                // Add new
                const id = await addProprietor(formData);
                if (id) {
                    onSuccess(id);
                } else {
                    setError('創建失敗');
                }
            }
        } catch (err) {
            setError(initialData ? '更新失敗' : '創建失敗');
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
                className="fixed top-0 left-0 w-screen h-screen bg-black/60 backdrop-blur-sm z-[60]"
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl z-[60] overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {initialData
                                ? (isEditing ? '編輯資料' : '詳細資料')
                                : (mode === 'tenant' ? '新增承租人' : '新增資產擁有方')
                            }
                        </h2>
                        {initialData && !isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-3 py-1 text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-all"
                            >
                                編輯
                            </button>
                        )}
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
                <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* View Mode (Non-Editing) */}
                    {initialData && !isEditing ? (
                        <div className="space-y-6 py-2">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <p className="text-xs text-zinc-400 dark:text-white/40 uppercase font-semibold">基本資料</p>
                                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{formData.name}</p>
                                    <p className="text-zinc-500 dark:text-white/50 text-sm">{formData.code}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-xs text-zinc-400 dark:text-white/40 uppercase font-semibold">英文名稱 / 簡稱</p>
                                    <p className="text-zinc-900 dark:text-white font-medium">{formData.englishName || '-'}</p>
                                    <p className="text-zinc-500 dark:text-white/50 text-sm">{formData.shortName || '-'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-400 dark:text-white/40 uppercase mb-1">性質</p>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                        {formData.type === 'company' ? '公司' : '個人'}
                                    </span>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-400 dark:text-white/40 uppercase mb-1">類別</p>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        {formData.category === 'external_customer' ? '街外客' : formData.category === 'group_company' ? '集團公司' : formData.category === 'joint_venture' ? '合資公司' : formData.category === 'managed_individual' ? '代管理的個體' : formData.category === 'external_landlord' ? '出租的業主' : '街外客'}
                                    </span>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/5">
                                    <p className="text-xs text-zinc-400 dark:text-white/40 uppercase mb-1">狀態</p>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                        活躍中
                                    </span>
                                </div>
                            </div>

                            {formData.description && (
                                <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                                    <p className="text-xs text-purple-500 uppercase font-semibold mb-2 flex items-center gap-2">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        簡介 / 備註
                                    </p>
                                    <p className="text-zinc-700 dark:text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                                        {formData.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
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
                                        placeholder="請輸入名稱"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '承租人代碼 *' : '擁有方代碼 *'}
                                    </label>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder={mode === 'tenant' ? "例如: T01" : "例如: A01"}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '承租人英文名稱' : '擁有方英文名稱'}
                                    </label>
                                    <input
                                        type="text"
                                        name="englishName"
                                        value={formData.englishName}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="例如: CITIC (HK) Investment Ltd"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '承租人簡稱' : '擁有方簡稱'}
                                    </label>
                                    <input
                                        type="text"
                                        name="shortName"
                                        value={formData.shortName}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="例如: CITIC"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '性質' : '擁有方性質'}
                                    </label>
                                    <AnimatedSelect
                                        name="type"
                                        value={formData.type}
                                        onChange={(value) => handleChange({ target: { name: 'type', value } } as any)}
                                        options={[
                                            { value: 'company', label: '公司' },
                                            { value: 'individual', label: '個人' }
                                        ]}
                                        placeholder="選擇性質"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '類別' : '擁有人類別'}
                                    </label>
                                    <AnimatedSelect
                                        name="category"
                                        value={formData.category}
                                        onChange={(value) => handleChange({ target: { name: 'category', value } } as any)}
                                        options={
                                            mode === 'tenant' ? [
                                                { value: 'external_customer', label: '街外客' },
                                                { value: 'group_company', label: '集團公司' }
                                            ] : [
                                                { value: 'group_company', label: '集團旗下公司' },
                                                { value: 'joint_venture', label: '合資公司' },
                                                { value: 'managed_individual', label: '代管理的個體' },
                                                { value: 'external_landlord', label: '出租的業主' }
                                            ]
                                        }
                                        placeholder="選擇類別"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                    簡介
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
                                    placeholder="請輸入簡介..."
                                />
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/5">
                        <button
                            type="button"
                            onClick={() => {
                                if (initialData && isEditing) {
                                    setIsEditing(false);
                                    // Reset form data if needed
                                    setFormData({
                                        name: initialData.name,
                                        code: initialData.code,
                                        type: initialData.type as any,
                                        category: initialData.category as any,
                                        englishName: initialData.englishName || '',
                                        shortName: initialData.shortName || '',
                                        description: (initialData as any).description || '',
                                    });
                                } else {
                                    onClose();
                                }
                            }}
                            className="px-4 py-2 rounded-xl text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                        >
                            取消
                        </button>
                        {isEditing && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <motion.div
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                            className="w-4 h-4 rounded-full bg-white"
                                        />
                                        儲存中...
                                    </>
                                ) : (
                                    initialData ? '更新資料' : (mode === 'tenant' ? '創建承租人' : '創建資產擁有方')
                                )}
                            </motion.button>
                        )}
                    </div>
                </form>
            </motion.div>
        </>
    );
}
