import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, X } from 'lucide-react';
import { useProprietors } from '@/hooks/useStorage';
import { type Proprietor } from '@/lib/db';
import { normalizeDuplicateName } from '@/lib/formatters';
import AnimatedSelect from '@/components/ui/AnimatedSelect';

interface ProprietorModalProps {
    onClose: () => void;
    onSuccess: (proprietorId: string, proprietorData?: Partial<Proprietor>) => void;
    mode?: 'proprietor' | 'tenant';
    initialData?: Proprietor | null;
    propertyCode?: string; // 當前物業編號，用於產生業主代碼
    initialEditing?: boolean; // 控制初始是否為編輯模式
}

export default function ProprietorModal({ onClose, onSuccess, mode = 'proprietor', initialData, propertyCode, initialEditing }: ProprietorModalProps) {
    const { getProprietors, addProprietor, updateProprietor, loading } = useProprietors();
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(initialEditing !== undefined ? initialEditing : !initialData);
    const [error, setError] = useState('');
    const [existingTenants, setExistingTenants] = useState<Proprietor[]>([]);
    const [showTenantList, setShowTenantList] = useState(false);
    const tenantInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        code: initialData?.code || '',
        type: (initialData?.type || 'company') as 'company' | 'individual',
        category: (initialData?.category || (mode === 'tenant' ? 'external_customer' : 'group_company')) as any,
        englishName: initialData?.englishName || '',
        shortName: initialData?.shortName || '',
        description: (initialData as any)?.description || '',
    });

    // 業主代碼/承租人編號: 業主用propertyCode或自動產生；承租人用placeholder不預填
    useEffect(() => {
        if (initialData) return;

        if (propertyCode && mode === 'proprietor') {
            const code = propertyCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3) || 'A01';
            setFormData(prev => ({ ...prev, code }));
            return;
        }

        if (mode === 'tenant') {
            setFormData(prev => ({ ...prev, code: '' }));
            return;
        }

        const generateCode = async () => {
            const data = await getProprietors();
            const prefix = 'A';
            const sameTypeCount = data.filter(p => p.code?.startsWith(prefix)).length + 1;
            const code = `${prefix}${sameTypeCount.toString().padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, code }));
        };
        generateCode();
    }, [getProprietors, mode, initialData, propertyCode]);

    useEffect(() => {
        if (mode === 'tenant') {
            getProprietors().then(data => {
                const tenants = data
                    .filter(p => p.code?.startsWith('T'))
                    .filter(p => {
                        const n = (p.name || '').trim();
                        if (!n) return false;
                        // 排除物業：property code (A01-P001)、地址 (號/公路/村口等)
                        if (/[A-Z]?\d*-?P\d+/.test(n) || n.endsWith('號') || /公路|村口|七星崗/.test(n)) return false;
                        // 排除車型/產品描述 (如 Benz Vito 116 (豪華版))
                        if (/\(豪華版\)|\(.*版\)/.test(n) || /\d+\s*\(/.test(n)) return false;
                        // 排除純英文+數字的 identifier (如 jeff-zxs-sss)
                        if (/^[a-zA-Z0-9-_]+$/.test(n) && n.length >= 8) return false;
                        return true;
                    })
                    .sort((a, b) => (a.name?.length || 0) - (b.name?.length || 0));
                setExistingTenants(tenants);
            });
        }
    }, [mode, getProprietors]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'name') setError('');
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const nameNorm = normalizeDuplicateName(formData.name || '');
        if (!nameNorm) {
            setError('請輸入名稱');
            return;
        }

        try {
            const all = await getProprietors();
            const inOwnerPool = (p: Proprietor) => !p.code?.startsWith('T');
            const inTenantPool = (p: Proprietor) => p.code?.startsWith('T');
            const pool = mode === 'tenant' ? all.filter(inTenantPool) : all.filter(inOwnerPool);

            if (initialData?.id) {
                const dup = pool.some(
                    p =>
                        p.id !== initialData.id &&
                        normalizeDuplicateName(p.name || '') === nameNorm
                );
                if (dup) {
                    setError('已有相同名稱，請使用其他名稱');
                    return;
                }
            } else {
                const dup = pool.some(p => normalizeDuplicateName(p.name || '') === nameNorm);
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

        try {
            if (initialData?.id) {
                // Update existing
                const success = await updateProprietor(initialData.id, formData);
                if (success) {
                    onSuccess(initialData.id, {
                        ...initialData,
                        name: formData.name,
                        code: formData.code,
                        englishName: formData.englishName,
                        shortName: formData.shortName,
                    });
                } else {
                    setError('更新失敗');
                }
            } else {
                // Add new
                const id = await addProprietor(formData);
                if (id) {
                    onSuccess(id, {
                        id,
                        name: formData.name,
                        code: formData.code,
                        englishName: formData.englishName,
                        shortName: formData.shortName,
                        type: formData.type,
                        category: formData.category,
                        description: (formData as any).description,
                    } as Partial<Proprietor>);
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

    const categoryLabel =
        formData.category === 'external_customer' ? '街外客' :
        formData.category === 'group_company' ? (mode === 'proprietor' ? '集團旗下公司' : '集團公司') :
        formData.category === 'joint_venture' ? '合資公司' :
        formData.category === 'managed_individual' ? '代管理的個體' :
        formData.category === 'external_landlord' ? '出租的業主' : '—';

    /** 與現時租客詳情同 shell：承租人／業主檢視模式 */
    const isDetailLayoutMode = Boolean(initialData && !isEditing);

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className={
                    isDetailLayoutMode
                        ? 'fixed inset-0 min-h-screen bg-black/60 backdrop-blur-sm z-70'
                        : 'fixed top-0 left-0 w-screen h-screen min-h-screen bg-black/60 backdrop-blur-sm z-60'
                }
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={
                    isDetailLayoutMode
                        ? 'fixed inset-0 m-auto h-fit max-h-[90vh] overflow-y-auto w-full max-w-3xl flex flex-col bg-white dark:bg-[#1a1a2e] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-70'
                        : 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl z-60'
                }
                onClick={isDetailLayoutMode ? (e) => e.stopPropagation() : undefined}
            >
                {/* Header */}
                <div className={`flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 ${isDetailLayoutMode ? 'shrink-0' : ''}`}>
                    {isDetailLayoutMode ? (
                        <>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                    {mode === 'tenant' ? (
                                        <Users className="w-5 h-5" />
                                    ) : (
                                        <Building2 className="w-5 h-5" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                        {mode === 'tenant' ? '承租人詳細資料' : '業主詳細資料'}
                                    </h2>
                                    <p className="text-sm text-zinc-500 dark:text-white/50 truncate">{formData.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 text-sm font-medium transition-all"
                                >
                                    編輯
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                                    {initialData
                                        ? (isEditing ? '編輯資料' : '詳細資料')
                                        : (mode === 'tenant' ? '新增承租人' : '新增業主')
                                    }
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-lg text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className={isDetailLayoutMode ? 'flex flex-col flex-1 min-h-0' : 'p-5 space-y-4 overflow-visible'}>
                    {/* View Mode：承租人／業主與現時租客詳情同風格 */}
                    {initialData && !isEditing ? (
                            <>
                                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                    <section>
                                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">基本資料</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">名稱</p>
                                                <p className="text-sm font-bold text-zinc-900 dark:text-white wrap-break-word">{formData.name}</p>
                                            </div>
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">
                                                    {mode === 'tenant' ? '承租人編號' : '業主代碼'}
                                                </p>
                                                <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">{formData.code || '—'}</p>
                                            </div>
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">狀態</p>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white">活躍中</p>
                                            </div>
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 md:col-span-2">
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">公司／英文名稱</p>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white wrap-break-word">{formData.englishName || '—'}</p>
                                            </div>
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-1">簡稱</p>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white wrap-break-word">{formData.shortName || '—'}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">分類</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-2">性質</p>
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                    {formData.type === 'company' ? '公司' : '個人'}
                                                </span>
                                            </div>
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-xs text-zinc-500 dark:text-white/50 mb-2">類別</p>
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    {categoryLabel}
                                                </span>
                                            </div>
                                        </div>
                                    </section>

                                    {formData.description ? (
                                        <section>
                                            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3">BR Number</h3>
                                            <div className="p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                <p className="text-sm text-zinc-700 dark:text-white/80 whitespace-pre-wrap wrap-break-word">{formData.description}</p>
                                            </div>
                                        </section>
                                    ) : null}
                                </div>

                                <div className="p-5 border-t border-zinc-100 dark:border-white/5 shrink-0 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-5 py-2 bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white rounded-xl hover:bg-zinc-200 dark:hover:bg-white/20 text-sm font-medium transition-all"
                                    >
                                        關閉
                                    </button>
                                </div>
                            </>
                    ) : (
                        <>
                            {/* Row 1: 個人名稱 * | 公司名稱 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '名稱 *' : '個人名稱 *'}
                                    </label>
                                    {mode === 'tenant' ? (
                                        <div className="relative w-full">
                                            <input
                                                ref={tenantInputRef}
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                onFocus={() => setShowTenantList(true)}
                                                onBlur={() => setTimeout(() => setShowTenantList(false), 150)}
                                                autoComplete="off"
                                                required
                                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                                placeholder="請輸入名稱或從下方選擇現有承租人"
                                            />
                                            <AnimatePresence>
                                                {showTenantList && existingTenants.length > 0 && (
                                                    <motion.ul
                                                        initial={{ opacity: 0, y: -4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -4 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                                                    >
                                                        {existingTenants.map(t => (
                                                            <li
                                                                key={t.id}
                                                                className="px-4 py-2.5 text-sm text-zinc-900 dark:text-white cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                                                onMouseDown={(e) => { e.preventDefault(); setFormData(prev => ({ ...prev, name: t.name || '' })); setShowTenantList(false); }}
                                                            >
                                                                {t.name}
                                                            </li>
                                                        ))}
                                                    </motion.ul>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                            placeholder="請輸入個人名稱"
                                        />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '承租人英文名稱' : '公司名稱'}
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
                            </div>

                            {/* Row 2: 業主代碼 * | BR Number */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '承租人編號 *' : '業主代碼 *'}
                                    </label>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder={mode === 'tenant' ? "請輸入承租人編號 (每次不同)" : "例如: A01"}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        BR Number
                                    </label>
                                    <input
                                        type="text"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="請輸入 BR Number"
                                    />
                                </div>
                            </div>

                            {/* Row 3: 業主性質 | 擁有人類別 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-white/80">
                                        {mode === 'tenant' ? '性質' : '業主性質'}
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
                        </>
                    )}

                    {/* Actions（詳情版面已含底部關閉，不重複顯示） */}
                    {!isDetailLayoutMode && (
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
                                    initialData ? '更新資料' : (mode === 'tenant' ? '創建承租人' : '創建業主')
                                )}
                            </motion.button>
                        )}
                    </div>
                    )}
                </form>
            </motion.div>
        </>
    );
}
