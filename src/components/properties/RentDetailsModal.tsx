'use client';

import { motion } from 'framer-motion';
import { X, Building2, User } from 'lucide-react';
import type { Rent, Property, Proprietor } from '@/lib/db';
import { formatLotArea, proprietorCategoryLabelZh } from '@/lib/formatters';
import {
    getRentOutCollectionDisplayPeriod,
    labelRentCollectionPaymentMethod,
    getRentOutOrContractListNumber,
} from '@/lib/rentPaymentDisplay';
import { useLanguage } from '@/components/common/LanguageSwitcher';
import DOMPurify from 'dompurify';
import { Tooltip } from '@heroui/react';

interface RentDetailsModalProps {
    rent: Rent;
    property?: Property;
    onClose: () => void;
}

function DetailRow({ label, value, tooltipContent }: { label: string; value: any; tooltipContent?: React.ReactNode }) {
    if (value == null || value === '' || value === '-') return null;

    const valueNode = <span className={`text-sm font-medium ${tooltipContent ? 'text-purple-600 dark:text-purple-400 border-b border-dashed border-purple-300 dark:border-purple-600/50 cursor-pointer' : 'text-zinc-900 dark:text-white'} text-right block`}>
        {typeof value === 'string' || typeof value === 'number' ? String(value) : value}
    </span>;

    return (
        <div className="flex justify-between items-start gap-4 py-2 border-b border-zinc-50 dark:border-white/5 last:border-none">
            <span className="text-sm text-zinc-500 dark:text-white/50 whitespace-nowrap">{label}</span>
            {tooltipContent ? (
                <Tooltip content={tooltipContent} placement="top" className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 max-w-xs">
                    {valueNode}
                </Tooltip>
            ) : (
                valueNode
            )}
        </div>
    );
}

export default function RentDetailsModal({ rent, property, onClose }: RentDetailsModalProps) {
    const lang = useLanguage();
    const isZh = lang === 'zh-TW';
    const t = (en: string, zh: string) => isZh ? zh : en;

    const formatCurrency = (val: any) => {
        if (!val) return '-';
        return `$${Number(val).toLocaleString()}`;
    };

    const formatDate = (d: any) => {
        if (!d) return '-';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '-';
        return isZh
            ? date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
            : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const rentOutListPeriod = rent.type === 'rent_out' ? getRentOutCollectionDisplayPeriod(rent) : null;
    const endDateForExpiry =
        rent.type === 'renting'
            ? rent.rentingEndDate
            : rent.type === 'rent_out'
              ? rentOutListPeriod?.end || rent.rentOutEndDate
              : rent.rentOutEndDate;
    const isExpired = endDateForExpiry
        ? new Date(endDateForExpiry) < new Date(new Date().setHours(0, 0, 0, 0))
        : false;

    const isRentOutLike = rent.type === 'rent_out' || rent.type === 'contract';
    /** 交租：頂部編號與列表一致，優先顯示物業編號 */
    const rentingDisplayNumber =
        (property?.code?.trim() || rent.rentingNumber?.trim() || '-');

    let statusValueRentOut: React.ReactNode =
        rent.rentOutStatus === 'listing' ? '放盤中' :
        rent.rentOutStatus === 'renting' ? '出租中' :
        rent.rentOutStatus === 'leasing_in' ? '租入中' :
        rent.rentOutStatus === 'completed' ? '已完租' : rent.rentOutStatus;
    if (isExpired) {
        statusValueRentOut = <span className="text-red-500 font-bold whitespace-nowrap">已過期</span>;
    }

    let statusValueRenting: React.ReactNode = '生效中';
    if (isExpired) {
        statusValueRenting = <span className="text-red-500 font-bold whitespace-nowrap">已過期</span>;
    }

    const contractNatureLabelZh = (v: string | undefined) => {
        const map: Record<string, string> = {
            parking: '車位',
            temporary_parking: '臨時車位',
            rental_venue: '租用埸地',
        };
        if (!v?.trim()) return '';
        return map[v] || v;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 w-full max-w-lg max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/10 sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-2 rounded-xl bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30">
                            <span className="text-base font-bold font-mono text-purple-700 dark:text-purple-300">
                                {isRentOutLike ? getRentOutOrContractListNumber(rent as Rent) : rentingDisplayNumber}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                {rent.type === 'contract' ? t('Contract Details', '合約詳情') : t('Rent Details', '租約詳情')}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-xs mt-1 block w-fit ${rent.type === 'contract' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : rent.type === 'rent_out' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                                {rent.type === 'contract' ? t('Contract', '合約記錄') : rent.type === 'rent_out' ? t('Rent Out', '收租') : t('Renting', '交租')}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-1">
                    {isRentOutLike ? (
                        <>
                            <DetailRow label={t('Tenancy Number', '合約號碼')} value={rent.rentOutTenancyNumber} />
                            <DetailRow label={t('Monthly Rent', '月租')} value={formatCurrency(rent.rentOutMonthlyRental)} />
                            <DetailRow label={t('Listing Price', '放盤價')} value={formatCurrency(rent.rentOutPricing)} />
                            <DetailRow label={t('Periods', '期數')} value={rent.rentOutPeriods} />
                            <DetailRow label={t('Total Amount', '總額')} value={formatCurrency(rent.rentOutTotalAmount)} />
                            <DetailRow
                                label={t('Start Date', '開始日期')}
                                value={formatDate(
                                    rent.type === 'rent_out'
                                        ? rentOutListPeriod?.start || rent.rentOutStartDate
                                        : rent.rentOutStartDate,
                                )}
                            />
                            <DetailRow
                                label={t('End Date', '結束日期')}
                                value={formatDate(
                                    rent.type === 'rent_out'
                                        ? rentOutListPeriod?.end || rent.rentOutEndDate
                                        : rent.rentOutEndDate,
                                )}
                            />
                            {rent.type === 'contract' ? (
                                <DetailRow
                                    label={t('Contract nature', '合約性質')}
                                    value={contractNatureLabelZh((rent as any).rentOutContractNature)}
                                />
                            ) : null}
                            <DetailRow label={t('Deposit Received', '按金')} value={formatCurrency(rent.rentOutDepositReceived)} />
                            {(rent as any).rentOutDepositPaymentMethod ? (
                                <DetailRow
                                    label={t('Deposit payment method', '按金支付方式')}
                                    value={labelRentCollectionPaymentMethod((rent as any).rentOutDepositPaymentMethod)}
                                />
                            ) : null}
                            {rent.type === 'contract' && (rent as any).rentOutDepositPaymentMethod === 'cheque' ? (
                                <>
                                    <DetailRow label={t('Cheque bank', '按金支票銀行')} value={(rent as any).rentOutDepositChequeBank} />
                                    <DetailRow label={t('Cheque number', '按金支票號碼')} value={(rent as any).rentOutDepositChequeNumber} />
                                </>
                            ) : null}
                            <DetailRow
                                label={t('Deposit payment date', '按金付款日期')}
                                value={formatDate((rent as any).rentOutDepositPaymentDate)}
                            />
                            {(rent as any).rentOutDepositPaymentMethod &&
                            (rent as any).rentOutDepositPaymentMethod !== 'cheque' &&
                            (rent as any).rentOutDepositReceiptNumber ? (
                                <DetailRow
                                    label={t('Receipt number', '收據號碼')}
                                    value={(rent as any).rentOutDepositReceiptNumber}
                                />
                            ) : null}
                            <DetailRow label={t('Deposit Receive Date', '按金收取日期')} value={formatDate(rent.rentOutDepositReceiveDate)} />
                            <DetailRow label={t('Deposit Return Date', '按金退回日期')} value={formatDate(rent.rentOutDepositReturnDate)} />
                            <DetailRow label={t('Deposit Return Amount', '按金退回金額')} value={formatCurrency(rent.rentOutDepositReturnAmount)} />
                            <DetailRow label={t('Status', '狀態')} value={statusValueRentOut} />

                            {property && (
                                <DetailRow
                                    label={t('Property', '物業')}
                                    value={property.name}
                                    tooltipContent={
                                        <div className="flex flex-col gap-1.5 w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Building2 className="w-4 h-4 text-purple-500" />
                                                <span className="font-bold">{property.name}</span>
                                                <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">{property.code}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60">
                                                地段: <span className="text-zinc-900 dark:text-white">{property.lotIndex || '-'}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60">
                                                面積: <span className="text-zinc-900 dark:text-white">{formatLotArea(property.lotArea)}</span>
                                            </div>
                                        </div>
                                    }
                                />
                            )}
                            {rent.tenant && (
                                <DetailRow
                                    label={t('Tenant', '承租人')}
                                    value={rent.tenant.name}
                                    tooltipContent={
                                        <div className="flex flex-col gap-1.5 w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <User className="w-4 h-4 text-blue-500" />
                                                <span className="font-bold">{rent.tenant.name}</span>
                                                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">{rent.tenant.code}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60">
                                                英文名稱: <span className="text-zinc-900 dark:text-white text-[10px]">{rent.tenant.englishName || '-'}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60 flex items-center justify-between">
                                                <span>類型: <span className="text-zinc-900 dark:text-white">{rent.tenant.type === 'company' ? '公司' : '個人'}</span></span>
                                                <span className="bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 dark:text-white/70">
                                                    {proprietorCategoryLabelZh(rent.tenant.category, 'card')}
                                                </span>
                                            </div>
                                        </div>
                                    }
                                />
                            )}
                            {rent.rentOutDescription && (
                                <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-white/10">
                                    <p className="text-xs text-zinc-400 dark:text-white/40 mb-1">{t('Description', '描述')}</p>
                                    <div className="text-sm text-zinc-700 dark:text-white/80 rich-text-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rent.rentOutDescription) }} />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <DetailRow label={t('Rent Number', '租約號碼')} value={rent.rentingNumber} />
                            <DetailRow label={t('Reference Number', '對方租約號碼')} value={rent.rentingReferenceNumber} />
                            <DetailRow label={t('Monthly Rent', '月租')} value={formatCurrency(rent.rentingMonthlyRental)} />
                            <DetailRow label={t('Periods', '期數')} value={rent.rentingPeriods} />
                            <DetailRow label={t('Start Date', '開始日期')} value={formatDate(rent.rentingStartDate)} />
                            <DetailRow label={t('End Date', '結束日期')} value={formatDate(rent.rentingEndDate)} />
                            <DetailRow label={t('Deposit', '押金')} value={formatCurrency(rent.rentingDeposit)} />
                            <DetailRow label={t('Status', '狀態')} value={statusValueRenting} />

                            {property && (
                                <DetailRow
                                    label={t('Property', '物業')}
                                    value={property.name}
                                    tooltipContent={
                                        <div className="flex flex-col gap-1.5 w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Building2 className="w-4 h-4 text-purple-500" />
                                                <span className="font-bold">{property.name}</span>
                                                <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">{property.code}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60">
                                                地段: <span className="text-zinc-900 dark:text-white">{property.lotIndex || '-'}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60">
                                                面積: <span className="text-zinc-900 dark:text-white">{formatLotArea(property.lotArea)}</span>
                                            </div>
                                        </div>
                                    }
                                />
                            )}
                            {(rent.proprietor || rent.tenant) && (
                                <DetailRow
                                    label={t('Proprietor', '業主')}
                                    value={(rent.proprietor || rent.tenant)?.name}
                                    tooltipContent={
                                        <div className="flex flex-col gap-1.5 w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <User className="w-4 h-4 text-emerald-500" />
                                                <span className="font-bold">{(rent.proprietor || rent.tenant)?.name}</span>
                                                <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded text-[10px] ml-auto">{(rent.proprietor || rent.tenant)?.code}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60">
                                                英文名稱: <span className="text-zinc-900 dark:text-white text-[10px]">{(rent.proprietor || rent.tenant)?.englishName || '-'}</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-white/60 flex items-center justify-between">
                                                <span>類型: <span className="text-zinc-900 dark:text-white">{(rent.proprietor || rent.tenant)?.type === 'company' ? '公司' : '個人'}</span></span>
                                                <span className="bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 dark:text-white/70">
                                                    {proprietorCategoryLabelZh((rent.proprietor || rent.tenant)?.category, 'card')}
                                                </span>
                                            </div>
                                        </div>
                                    }
                                />
                            )}
                        </>
                    )}
                    {rent.notes && (
                        <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-white/10">
                            <p className="text-xs text-zinc-400 dark:text-white/40 mb-1">{t('Notes', '備註')}</p>
                            <p className="text-sm text-zinc-700 dark:text-white/80">{rent.notes}</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
