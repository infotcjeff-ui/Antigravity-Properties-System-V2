# 租務模組詳細參考文檔

本文檔是 [SKILL.md](SKILL.md) 的延伸，提供完整的程式碼範例、欄位列表與實作細節。

---

## 目錄

1. [TypeScript 完整介面定義](#1-typescript-完整介面定義)
2. [完整 rents 表欄位對照](#2-完整-rents-表欄位對照)
3. [React Query 鉤子完整定義](#3-react-query-鉤子完整定義)
4. [Supabase 查詢模式](#4-supabase-查詢模式)
5. [頁面完整程式碼](#5-頁面完整程式碼)
6. [UI 樣式與 Dark Mode](#6-ui-樣式與-dark-mode)
7. [業務邏輯函式](#7-業務邏輯函式)
8. [Mobile App 實作範例](#8-mobile-app-實作範例)

---

## 1. TypeScript 完整介面定義

完整定義見 `src/lib/db.ts`：

```typescript
// 付款方式
export type RentCollectionPaymentMethod = 'cheque' | 'fps' | 'cash' | 'bank_in';

// rents 表主介面
export interface Rent {
  id?: string;
  propertyId: string;
  proprietorId?: string; // 業主
  tenantId?: string;    // 租客
  type: 'renting' | 'rent_out' | 'contract';

  // Legacy 通用欄位
  location?: string;
  amount?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'pending' | 'completed' | 'cancelled';
  notes?: string;

  // ===== 收租 (rent_out) =====
  rentOutTenancyNumber?: string;
  rentOutPricing?: number;
  rentOutMonthlyRental?: number;
  rentOutPeriods?: number;
  rentOutTotalAmount?: number;
  rentOutStartDate?: Date;
  rentOutEndDate?: Date;
  rentOutActualEndDate?: Date;
  rentOutDepositReceived?: number;
  rentOutDepositPaymentMethod?: RentCollectionPaymentMethod;
  rentOutDepositReceiptNumber?: string;
  rentOutDepositReceiveDate?: Date;
  rentOutDepositReturnDate?: Date;
  rentOutDepositReturnAmount?: number;
  rentOutLessor?: string;
  rentOutAddressDetail?: string;
  rentOutStatus?: 'listing' | 'renting' | 'leasing_in' | 'completed';
  rentOutDescription?: string;
  rentOutSubLandlord?: string;      // legacy display name
  rentOutSubLandlordId?: string;    // FK → sub_landlords
  rentOutTenants?: string[];        // legacy
  rentOutTenantIds?: string[];      // FKs → current_tenants

  // ===== 收租記錄 =====
  rentCollectionTenantName?: string;
  rentCollectionDate?: Date;
  rentCollectionAmount?: number;
  rentCollectionPaymentMethod?: RentCollectionPaymentMethod;
  rentCollectionChequeBank?: string;
  rentCollectionChequeNumber?: string;
  rentCollectionChequeImage?: string;  // base64 data URL
  rentCollectionPaymentDate?: Date;
  rentCollectionBankInImage?: string;  // base64 data URL

  // ===== 交租 (renting) =====
  rentingNumber?: string;
  rentingReferenceNumber?: string;
  rentingMonthlyRental?: number;
  rentingPeriods?: number;
  rentingStartDate?: Date;
  rentingEndDate?: Date;
  rentingDeposit?: number;

  // ===== 合約 (contract) =====
  contractNumber?: string;
  contractType?: 'sale' | 'purchase' | 'management' | 'other';
  contractTitle?: string;
  contractParties?: string;
  contractValue?: number;
  contractCurrency?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
  contractStatus?: 'active' | 'pending' | 'completed' | 'cancelled' | 'expired';
  contractDescription?: string;
  contractDocumentUrl?: string;

  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;

  // Relations
  property?: Property;
  proprietor?: Proprietor;
  tenant?: Proprietor;
  currentTenant?: CurrentTenant;
}

// 二房東
export interface SubLandlord {
  id?: string;
  name: string;
  tenancyNumber?: string;
  pricing?: number;
  monthlyRental?: number;
  periods?: number;
  totalAmount?: number;
  startDate?: Date;
  endDate?: Date;
  actualEndDate?: Date;
  depositReceived?: number;
  depositReceiptNumber?: string;
  depositReceiveDate?: Date;
  depositReturnDate?: Date;
  depositReturnAmount?: number;
  lessor?: string;
  addressDetail?: string;
  status?: 'listing' | 'renting' | 'leasing_in' | 'completed';
  description?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
}

// 現時租客
export interface CurrentTenant {
  id?: string;
  name: string;
  tenancyNumber?: string;
  pricing?: number;
  monthlyRental?: number;
  periods?: number;
  totalAmount?: number;
  startDate?: Date;
  endDate?: Date;
  actualEndDate?: Date;
  depositReceived?: number;
  depositReceiptNumber?: string;
  depositReceiveDate?: Date;
  depositReturnDate?: Date;
  depositReturnAmount?: number;
  lessor?: string;
  addressDetail?: string;
  status?: 'listing' | 'renting' | 'leasing_in' | 'completed';
  description?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
}
```

---

## 2. 完整 rents 表欄位對照

### DB 欄位 ↔ TypeScript 欄位 ↔ 用途對照表

| DB 欄位 (snake_case) | TS 欄位 (camelCase) | 用途說明 | 適用 type |
|---------------------|--------------------|---------|----------|
| `property_id` | `propertyId` | 關聯物业 | 全部 |
| `proprietor_id` | `proprietorId` | 業主 | 全部 |
| `tenant_id` | `tenantId` | 租客 | 全部 |
| `type` | `type` | `renting` / `rent_out` / `contract` | 全部 |
| `rent_out_tenancy_number` | `rentOutTenancyNumber` | 出租合約號碼 | rent_out |
| `rent_out_pricing` | `rentOutPricing` | 放盤價 | rent_out |
| `rent_out_monthly_rental` | `rentOutMonthlyRental` | 月租 | rent_out |
| `rent_out_periods` | `rentOutPeriods` | 期數 | rent_out |
| `rent_out_total_amount` | `rentOutTotalAmount` | 總額 | rent_out |
| `rent_out_start_date` | `rentOutStartDate` | 合約開始日期 | rent_out |
| `rent_out_end_date` | `rentOutEndDate` | 合約結束日期 | rent_out |
| `rent_out_actual_end_date` | `rentOutActualEndDate` | 實際結束日期 | rent_out |
| `rent_out_deposit_received` | `rentOutDepositReceived` | 按金 | rent_out |
| `rent_out_deposit_payment_method` | `rentOutDepositPaymentMethod` | 按金付款方式 | rent_out |
| `rent_out_deposit_receipt_number` | `rentOutDepositReceiptNumber` | 按金收據號 | rent_out |
| `rent_out_deposit_receive_date` | `rentOutDepositReceiveDate` | 按金收取日期 | rent_out |
| `rent_out_deposit_return_date` | `rentOutDepositReturnDate` | 按金退回日期 | rent_out |
| `rent_out_deposit_return_amount` | `rentOutDepositReturnAmount` | 按金退回金額 | rent_out |
| `rent_out_lessor` | `rentOutLessor` | 出租人 | rent_out |
| `rent_out_address_detail` | `rentOutAddressDetail` | 地址資料 | rent_out |
| `rent_out_status` | `rentOutStatus` | `listing/renting/leasing_in/completed` | rent_out |
| `rent_out_description` | `rentOutDescription` | 描述（rich text）| rent_out |
| `rent_out_sub_landlord_id` | `rentOutSubLandlordId` | 二房東 FK | rent_out |
| `rent_out_tenant_ids` | `rentOutTenantIds` | 現時租客 IDs (JSONB) | rent_out |
| `rent_collection_tenant_name` | `rentCollectionTenantName` | 租客名稱 | rent_out |
| `rent_collection_date` | `rentCollectionDate` | 收租日期 | rent_out |
| `rent_collection_amount` | `rentCollectionAmount` | 收租金額 | rent_out |
| `rent_collection_payment_method` | `rentCollectionPaymentMethod` | 付款方式 | rent_out |
| `rent_collection_cheque_bank` | `rentCollectionChequeBank` | 支票銀行 | rent_out |
| `rent_collection_cheque_number` | `rentCollectionChequeNumber` | 支票號碼 | rent_out |
| `rent_collection_cheque_image` | `rentCollectionChequeImage` | 支票影像（base64）| rent_out |
| `rent_collection_payment_date` | `rentCollectionPaymentDate` | 付款日期 | rent_out |
| `rent_collection_bank_in_image` | `rentCollectionBankInImage` | 入數截圖（base64）| rent_out |
| `renting_number` | `rentingNumber` | 我方租約號碼 | renting |
| `renting_reference_number` | `rentingReferenceNumber` | 對方租約號碼 | renting |
| `renting_monthly_rental` | `rentingMonthlyRental` | 每月租金 | renting |
| `renting_periods` | `rentingPeriods` | 期限 | renting |
| `renting_start_date` | `rentingStartDate` | 租期開始 | renting |
| `renting_end_date` | `rentingEndDate` | 租期結束 | renting |
| `renting_deposit` | `rentingDeposit` | 押金 | renting |
| `contract_number` | `contractNumber` | 合約編號 | contract |
| `contract_type` | `contractType` | `sale/purchase/management/other` | contract |
| `contract_title` | `contractTitle` | 合約標題 | contract |
| `contract_parties` | `contractParties` | 合約各方 | contract |
| `contract_value` | `contractValue` | 合約金額 | contract |
| `contract_currency` | `contractCurrency` | 貨幣 | contract |
| `contract_start_date` | `contractStartDate` | 開始日期 | contract |
| `contract_end_date` | `contractEndDate` | 結束日期 | contract |
| `contract_status` | `contractStatus` | `active/pending/completed/cancelled/expired` | contract |
| `contract_description` | `contractDescription` | 描述 | contract |
| `contract_document_url` | `contractDocumentUrl` | 文件連結 | contract |

---

## 3. React Query 鉤子完整定義

### 查詢 (Read)

```typescript
// src/hooks/useStorage.ts

// 查詢所有 rents（可指定 type）
export function useRentsWithRelationsQuery(options?: {
  type?: 'renting' | 'rent_out' | 'contract'
}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rents-with-relations', user?.id, options?.type],
    queryFn: () => fetchRentsWithRelations(user, options),
    staleTime: 2 * 60 * 1000,  // 2 分鐘
  });
}

// fetchRentsWithRelations 內部實作
export const fetchRentsWithRelations = async (
  user?: any,
  options?: { type?: 'renting' | 'rent_out' | 'contract' }
): Promise<any[]> => {
  let query = supabase
    .from('rents')
    .select(`
      *,
      property:properties(*),
      proprietor:proprietors!proprietor_id(*),
      tenant:proprietors!tenant_id(*),
      currentTenant:sub_landlords(*)
    `)
    .is('is_deleted', false);

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// 查詢某物业的所有相關記錄
export const fetchRentsByProperty = async (propertyId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('rents')
    .select('*')
    .eq('property_id', propertyId)
    .is('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
```

### 增刪改 (Create/Delete/Update)

```typescript
// useRents hook
export const useRents = () => {
  const { user } = useAuth();
  // ... 實作
  return {
    createRent: async (data: Partial<Rent>) => { /* ... */ },
    updateRent: async (id: string, data: Partial<Rent>) => { /* ... */ },
    deleteRent: async (id: string) => { /* 軟刪除 */ },
  };
};
```

### 使用範例

```typescript
// 列表頁
const { data: rentOutList, isLoading } = useRentsWithRelationsQuery({ type: 'rent_out' });
const { data: rentingList, isLoading } = useRentsWithRelationsQuery({ type: 'renting' });
const { data: contractList, isLoading } = useRentsWithRelationsQuery({ type: 'contract' });

// 詳情頁
const { data: propertyRents } = useRents();  // 或 fetchRentsByProperty(propertyId)

// 新增 / 更新 / 刪除
const { createRent, updateRent, deleteRent } = useRents();
```

---

## 4. Supabase 查詢模式

### 查詢所有收租記錄（含關聯）

```typescript
await supabase
  .from('rents')
  .select(`
    *,
    property:properties(*),
    proprietor:proprietors!proprietor_id(*),
    tenant:proprietors!tenant_id(*),
    currentTenant:sub_landlords(*)
  `)
  .eq('type', 'rent_out')
  .is('is_deleted', false)
  .order('created_at', { ascending: false });
```

### 查詢某物业的所有記錄

```typescript
await supabase
  .from('rents')
  .select('*')
  .eq('property_id', propertyId)
  .in('type', ['rent_out', 'contract'])
  .is('is_deleted', false);
```

### 新增記錄

```typescript
await supabase
  .from('rents')
  .insert({
    property_id: propertyId,
    type: 'rent_out',
    rent_out_tenancy_number: 'A01-P001-2024',
    rent_out_monthly_rental: 50000,
    rent_out_periods: 24,
    rent_out_total_amount: 1200000,
    rent_out_start_date: '2024-01-01',
    rent_out_end_date: '2025-12-31',
    rent_out_status: 'renting',
    rent_out_deposit_received: 100000,
    rent_out_deposit_payment_method: 'bank_in',
    created_by: userId,
  });
```

### 更新記錄

```typescript
await supabase
  .from('rents')
  .update({
    rent_out_monthly_rental: 55000,
    rent_collection_amount: 55000,
    rent_collection_payment_method: 'fps',
    rent_collection_payment_date: '2024-02-01',
  })
  .eq('id', rentId);
```

### 軟刪除

```typescript
await supabase
  .from('rents')
  .update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  })
  .eq('id', rentId);
```

---

## 5. 頁面完整程式碼

### 5.1 收租頁 (rent-out/page.tsx) 核心結構

```tsx
'use client';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRentsWithRelationsQuery, useRents } from '@/hooks/useStorage';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { BentoCard } from '@/components/layout/BentoGrid';
import RentModal from '@/components/properties/RentModal';
import {
  formatDateDMY,
  formatDateRangeDMY,
  getRentCollectionPayListStatus,
  hasRentCollectionPaidAmount,
  isPeriodEndExpired,
  labelRentCollectionPaymentMethod,
  matchesRentPaymentMethodFilter,
  type RentPaymentMethodFilterValue,
  type RentOutPayStatusFilterValue,
} from '@/lib/rentPaymentDisplay';
import type { Rent } from '@/lib/db';

const filterSelectClass =
  'mt-1 block w-full min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/10 ' +
  'bg-white dark:bg-[#1a1a2e] px-3 py-2 text-sm text-zinc-900 dark:text-white';

export default function RentOutPage() {
  const queryClient = useQueryClient();
  const { data: rents = [], isLoading } = useRentsWithRelationsQuery({ type: 'rent_out' });
  const { deleteRent } = useRents();

  const [showModal, setShowModal] = useState(false);
  const [selectedRent, setSelectedRent] = useState<Rent | null>(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<RentPaymentMethodFilterValue>('');
  const [filterRentOutPayStatus, setFilterRentOutPayStatus] = useState<RentOutPayStatusFilterValue>('');

  // 總收入
  const totalIncome = rents
    .filter(r => r.status === 'active' || r.rentOutStatus === 'renting')
    .reduce((sum, r) => sum + ((r.rentOutMonthlyRental || r.amount || 0) * (r.rentOutPeriods || 1)), 0);

  // 過濾
  const filteredRents = useMemo(() => {
    return rents.filter(r => {
      if (!matchesRentPaymentMethodFilter(r, filterPaymentMethod)) return false;
      if (filterRentOutPayStatus && getRentCollectionPayListStatus(r) !== filterRentOutPayStatus) return false;
      return true;
    });
  }, [rents, filterPaymentMethod, filterRentOutPayStatus]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('確定要刪除這條記錄嗎？')) return;
    const ok = await deleteRent(id);
    if (ok) queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-12 h-12 rounded-full bg-purple-500"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-500 md:hidden" />
            收租管理
          </h1>
          <p className="text-zinc-500 dark:text-white/50 mt-1 hidden sm:block">管理物業的租金收入與記錄</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setSelectedRent(null); setShowModal(true); }}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white font-medium shadow-lg shadow-emerald-500/20"
        >
          + 新增記錄
        </motion.button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <BentoCard>
          <p className="text-zinc-500 dark:text-white/50 text-sm">Total Income</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            HKD {totalIncome.toLocaleString()}
          </p>
        </BentoCard>
        <BentoCard>
          <p className="text-zinc-500 dark:text-white/50 text-sm">Total Records</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{rents.length}</p>
        </BentoCard>
        <BentoCard>
          <p className="text-zinc-500 dark:text-white/50 text-sm">Active Leases</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {rents.filter(r => r.status === 'active').length}
          </p>
        </BentoCard>
        <BentoCard>
          <p className="text-zinc-500 dark:text-white/50 text-sm">Pending</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {rents.filter(r => r.status === 'pending').length}
          </p>
        </BentoCard>
      </div>

      {/* 篩選器 */}
      {rents.length > 0 && (
        <div className="glass-card p-4 flex flex-col sm:flex-row flex-wrap gap-4 sm:items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-zinc-500 dark:text-white/50">付款方式</label>
            <select
              value={filterPaymentMethod}
              onChange={e => setFilterPaymentMethod(e.target.value as RentPaymentMethodFilterValue)}
              className={filterSelectClass}
            >
              <option value="">全部</option>
              <option value="none">未選擇</option>
              <option value="cheque">支票</option>
              <option value="fps">FPS轉帳</option>
              <option value="cash">現金</option>
              <option value="bank_in">入數</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-zinc-500 dark:text-white/50">繳付狀態</label>
            <select
              value={filterRentOutPayStatus}
              onChange={e => setFilterRentOutPayStatus(e.target.value as RentOutPayStatusFilterValue)}
              className={filterSelectClass}
            >
              <option value="">全部</option>
              <option value="paid">已繳付</option>
              <option value="unpaid">未繳付</option>
            </select>
          </div>
        </div>
      )}

      {/* 桌面端表格 */}
      <div className="hidden md:block glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-zinc-500 dark:text-white/50 text-sm border-b border-zinc-100 dark:border-white/5">
              <th className="p-4 font-medium">物業</th>
              <th className="p-4 font-medium">現時租客</th>
              <th className="p-4 font-medium">繳付金額</th>
              <th className="p-4 font-medium">付款方式</th>
              <th className="p-4 font-medium">付款日期</th>
              <th className="p-4 font-medium">租約期間</th>
              <th className="p-4 font-medium">租務狀態</th>
              <th className="p-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRents.map((rent: any, index) => {
              const prop = rent.property;
              const payStatus = getRentCollectionPayListStatus(rent);
              const payFilled = hasRentCollectionPaidAmount(rent);
              const expired = isPeriodEndExpired(rent.endDate || rent.rentOutEndDate);

              return (
                <motion.tr
                  key={rent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="p-4 text-zinc-900 dark:text-white font-medium">{prop?.name || '—'}</td>
                  <td className="p-4 text-zinc-600 dark:text-white/70">{rent.currentTenant?.name || rent.tenant?.name || '—'}</td>
                  <td className="p-4 text-green-600 dark:text-green-400 font-medium">
                    {payFilled
                      ? <>+ {rent.currency || 'HKD'} {Number(rent.rentCollectionAmount).toLocaleString()}</>
                      : <span className="text-zinc-400 dark:text-white/40">—</span>
                    }
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-white/70 text-sm">
                    {labelRentCollectionPaymentMethod(rent.rentCollectionPaymentMethod)}
                  </td>
                  <td className="p-4 text-zinc-500 dark:text-white/50 text-sm">
                    {rent.rentCollectionPaymentDate ? formatDateDMY(rent.rentCollectionPaymentDate) : '—'}
                  </td>
                  <td className={`p-4 text-sm ${expired ? 'text-red-500 font-medium' : 'text-zinc-500 dark:text-white/50'}`}>
                    {formatDateRangeDMY(
                      rent.rentCollectionDate || rent.rentOutStartDate || rent.startDate,
                      rent.endDate || rent.rentOutEndDate
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      payStatus === 'paid'
                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30'
                        : 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                    }`}>
                      {payStatus === 'paid' ? '已繳付' : '未繳付'}
                    </span>
                  </td>
                  <td className="p-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSelectedRent(rent); setShowModal(true); }}
                        className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => handleDelete(e, rent.id)}
                        className="p-2 rounded-lg text-zinc-400 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredRents.map((rent: any) => {
          const payStatus = getRentCollectionPayListStatus(rent);
          return (
            <div key={rent.id} className="glass-card p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{rent.property?.name || '—'}</p>
                  <p className="text-sm text-zinc-500">{rent.currentTenant?.name || '—'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  payStatus === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {payStatus === 'paid' ? '已繳' : '未繳'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">
                  {formatDateRangeDMY(rent.rentCollectionDate, rent.endDate || rent.rentOutEndDate)}
                </span>
                <span className="text-green-600 font-medium">
                  {rent.rentCollectionAmount ? `${rent.currency || 'HKD'} ${Number(rent.rentCollectionAmount).toLocaleString()}` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <RentModal
        open={showModal}
        defaultType="rent_out"
        rent={selectedRent}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false);
          queryClient.invalidateQueries({ queryKey: ['rents-with-relations'] });
        }}
      />
    </div>
  );
}
```

### 5.2 交租頁 (renting/page.tsx) 核心差異

交租頁與收租頁結構相似，主要差異：

```typescript
// 查詢 type 改為 'renting'
const { data: rents = [], isLoading } = useRentsWithRelationsQuery({ type: 'renting' });

// 統計改為「應繳」視角
const totalPayable = rents
  .filter(r => r.status === 'active')
  .reduce((sum, r) => sum + ((r.rentingMonthlyRental || r.amount || 0) * (r.rentingPeriods || 1)), 0);

// 欄位改用 renting_* 前綴
<td>{formatDateRangeDMY(rent.rentingStartDate, rent.rentingEndDate)}</td>

// Modal defaultType
<RentModal open={showModal} defaultType="renting" rent={selectedRent} ... />
```

### 5.3 合約頁 (contracts/page.tsx) 核心差異

```typescript
// 查詢 type 改為 'contract'
const { data: contracts = [], isLoading } = useRentsWithRelationsQuery({ type: 'contract' });

// Tab 切換：出租合約 vs 租賃合約（租入中）
const [contractListTab, setContractListTab] = useState<'lease_out' | 'lease_in'>('lease_out');
const leaseOutContracts = contracts.filter(c => c.rentOutStatus !== 'leasing_in');
const leaseInContracts = contracts.filter(c => c.rentOutStatus === 'leasing_in');

// 合約狀態色彩
const statusColors: Record<string, string> = {
  active:    'bg-green-500/20 text-green-400',
  pending:   'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
  expired:   'bg-zinc-500/20 text-zinc-400',
};

// 合約狀態下拉選項
const contractStatusOptions = [
  { value: 'active', label: '生效中' },
  { value: 'pending', label: '待生效' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
  { value: 'expired', label: '已過期' },
];

// 刪除前確認對話框（頁內 dialog，避免 window.confirm 樣式不一致）
const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; tenancyNumber?: string } | null>(null);
```

---

## 6. UI 樣式與 Dark Mode

### 6.1 色彩系統 (Tailwind)

```typescript
// 頁面主題色彩
primary-gradient:  "from-emerald-500 to-teal-500"   // 收租頁
amber-gradient:   "from-amber-500 to-orange-500"    // 合約頁
purple-gradient:  "from-purple-500 to-indigo-500"   // 交租頁

// 狀態標籤
paid:      'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-200'
unpaid:    'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200'
expired:   text-red-500 (紅色文字強調)

// Dark mode
dark:  bg-[#1a1a2e]   text-white
       border-white/10
       text-white/50  (次要文字)
       bg-white/5     (hover 背景)
       glass-card     (毛玻璃卡片)
```

### 6.2 玻璃質感卡片 (glass-card)

```css
/* src/app/globals.css 或 Tailwind config */
.glass-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 1rem;
}
.dark .glass-card {
  background: rgba(26, 26, 46, 0.8);
  border-color: rgba(255, 255, 255, 0.1);
}
```

### 6.3 BentoCard 元件

```tsx
// src/components/layout/BentoGrid.tsx
// 用法
<BentoCard>
  <p className="text-zinc-500 dark:text-white/50 text-sm">標題</p>
  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">數值</p>
</BentoCard>
```

### 6.4 篩選下拉框樣式

```typescript
const filterSelectClass =
  'mt-1 block w-full min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/10 ' +
  'bg-white dark:bg-[#1a1a2e] px-3 py-2 text-sm text-zinc-900 dark:text-white';
```

---

## 7. 業務邏輯函式

### 7.1 日期格式化

```typescript
// src/lib/rentPaymentDisplay.ts

// 格式化為 DD/MM/YYYY
formatDateDMY(new Date())           // → "26/03/2026"
formatDateDMY('2026-03-26')         // → "26/03/2026"
formatDateDMY(null)                 // → ""

// 日期範圍
formatDateRangeDMY(start, end)      // → "01/01/2024 至 31/12/2025"
formatDateRangeDMY(start, end, ' - ') // → "01/01/2024 - 31/12/2025"
```

### 7.2 付款狀態判斷

```typescript
// 是否有已繳金額（0 也算有填）
hasRentCollectionPaidAmount(rent)   // → boolean

// 繳付狀態（需同時滿足：有金額 AND 已選付款方式）
getRentCollectionPayListStatus(rent) // → 'paid' | 'unpaid'

// 租期是否已過（結束日 < 今天）
isPeriodEndExpired(rent.endDate)    // → boolean
```

### 7.3 付款方式標籤

```typescript
labelRentCollectionPaymentMethod('cheque')  // → "支票"
labelRentCollectionPaymentMethod('fps')    // → "FPS轉帳"
labelRentCollectionPaymentMethod('cash')   // → "現金"
labelRentCollectionPaymentMethod('bank_in')// → "入數"
labelRentCollectionPaymentMethod(null)     // → "—"
```

### 7.4 付款方式過濾

```typescript
// 篩選付款方式
matchesRentPaymentMethodFilter(rent, '')      // 全部通過
matchesRentPaymentMethodFilter(rent, 'fps')   // 只顯示 FPS
matchesRentPaymentMethodFilter(rent, 'none') // 只顯示未選擇
```

### 7.5 收租狀態下拉選項

```typescript
const RENT_OUT_CONTRACT_STATUS_OPTIONS = [
  { value: 'listing',    label: '放盤中' },
  { value: 'renting',    label: '出租中' },
  { value: 'leasing_in', label: '租入中' },
  { value: 'completed',  label: '已完租' },
];
```

---

## 8. Mobile App 實作範例

以下是在 React Native / Expo 環境中實現類似功能的參考結構。

### 8.1 導航結構

```typescript
// 使用 React Navigation Bottom Tabs
const Tab = createBottomTabNavigator();

<Tab.Navigator>
  <Tab.Screen name="RentOut" component={RentOutScreen} />
  <Tab.Screen name="Renting" component={RentingScreen} />
  <Tab.Screen name="Contracts" component={ContractsScreen} />
</Tab.Navigator>
```

### 8.2 收租列表頁 (React Native)

```typescript
// screens/RentOutScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Modal
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Rent } from '@/lib/db';

// 查詢
async function fetchRentOuts(): Promise<Rent[]> {
  const { data, error } = await supabase
    .from('rents')
    .select('*, property:properties(*), currentTenant:sub_landlords(*)')
    .eq('type', 'rent_out')
    .is('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// 列表項
function RentCard({ rent, onPress }: { rent: Rent; onPress: () => void }) {
  const payStatus = rent.rentCollectionAmount && rent.rentCollectionPaymentMethod
    ? 'paid' : 'unpaid';
  const expired = rent.rentOutEndDate
    ? new Date(rent.rentOutEndDate) < new Date()
    : false;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.propertyName}>{rent.property?.name || '—'}</Text>
        <View style={[styles.badge, payStatus === 'paid' ? styles.badgeGreen : styles.badgeAmber]}>
          <Text style={[styles.badgeText, payStatus === 'paid' ? styles.badgeTextGreen : styles.badgeTextAmber]}>
            {payStatus === 'paid' ? '已繳' : '未繳'}
          </Text>
        </View>
      </View>

      <Text style={styles.tenantName}>
        {rent.currentTenant?.name || rent.tenant?.name || '—'}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={[styles.date, expired && styles.dateExpired]}>
          {rent.rentOutStartDate
            ? `${new Date(rent.rentOutStartDate).toLocaleDateString('zh-HK')} - ${rent.rentOutEndDate ? new Date(rent.rentOutEndDate).toLocaleDateString('zh-HK') : '—'}`
            : '—'}
        </Text>
        {rent.rentCollectionAmount && (
          <Text style={styles.amount}>
            HKD {Number(rent.rentCollectionAmount).toLocaleString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// 主頁面
export default function RentOutScreen() {
  const queryClient = useQueryClient();
  const { data: rents = [], isLoading, refetch } = useQuery({
    queryKey: ['rents-with-relations', 'rent_out'],
    queryFn: fetchRentOuts,
  });

  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [modalVisible, setModalVisible] = useState(false);

  const filtered = rents.filter(r => {
    if (filter === 'paid') return r.rentCollectionAmount && r.rentCollectionPaymentMethod;
    if (filter === 'unpaid') return !r.rentCollectionAmount || !r.rentCollectionPaymentMethod;
    return true;
  });

  const totalIncome = rents
    .filter(r => r.status === 'active' || r.rentOutStatus === 'renting')
    .reduce((sum, r) => sum + ((r.rentOutMonthlyRental || r.amount || 0) * (r.rentOutPeriods || 1)), 0);

  if (isLoading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      {/* 統計 */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>總收入</Text>
          <Text style={styles.statValue}>HKD {totalIncome.toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>記錄數</Text>
          <Text style={styles.statValue}>{rents.length}</Text>
        </View>
      </View>

      {/* 篩選 */}
      <View style={styles.filterRow}>
        {(['all', 'paid', 'unpaid'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? '全部' : f === 'paid' ? '已繳' : '未繳'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 列表 */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id || ''}
        renderItem={({ item }) => (
          <RentCard rent={item} onPress={() => setModalVisible(true)} />
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>暫無收租資料</Text>
        }
      />

      {/* 新增按鈕 */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 表單 Modal */}
      <RentFormModal
        visible={modalVisible}
        defaultType="rent_out"
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ['rents-with-relations', 'rent_out'] });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
  },
  statLabel: { fontSize: 12, color: '#888' },
  statValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#10b981' },
  filterChipText: { color: '#666', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  list: { gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  propertyName: { fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeGreen: { backgroundColor: '#dcfce7' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextGreen: { color: '#16a34a' },
  badgeTextAmber: { color: '#d97706' },
  tenantName: { marginTop: 4, color: '#666', fontSize: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  date: { fontSize: 13, color: '#888' },
  dateExpired: { color: '#ef4444' },
  amount: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#aaa', fontSize: 16 },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#10b981', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300' },
});
```

### 8.3 收租表單 Modal (React Native)

```typescript
// components/RentFormModal.tsx
// 完整表單需包含以下欄位群（根據 type 動態顯示）

interface Props {
  visible: boolean;
  defaultType: 'renting' | 'rent_out' | 'contract';
  rent?: Rent | null;
  onClose: () => void;
  onSuccess: (rentId: string) => void;
}

const PAYMENT_METHODS = [
  { value: 'cheque', label: '支票' },
  { value: 'fps', label: 'FPS轉帳' },
  { value: 'cash', label: '現金' },
  { value: 'bank_in', label: '入數' },
];

const RENT_OUT_STATUS_OPTIONS = [
  { value: 'listing', label: '放盤中' },
  { value: 'renting', label: '出租中' },
  { value: 'leasing_in', label: '租入中' },
  { value: 'completed', label: '已完租' },
];

export default function RentFormModal({ visible, defaultType, rent, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const { createRent, updateRent } = useRents();

  const [form, setForm] = useState({
    // 通用
    propertyId: rent?.propertyId || '',
    // 收租欄位
    rentOutTenancyNumber: rent?.rentOutTenancyNumber || '',
    rentOutMonthlyRental: rent?.rentOutMonthlyRental || '',
    rentOutPeriods: rent?.rentOutPeriods || '',
    rentOutStartDate: rent?.rentOutStartDate || '',
    rentOutEndDate: rent?.rentOutEndDate || '',
    rentOutStatus: rent?.rentOutStatus || 'renting',
    // 收租記錄
    rentCollectionAmount: rent?.rentCollectionAmount || '',
    rentCollectionPaymentMethod: rent?.rentCollectionPaymentMethod || '',
    rentCollectionPaymentDate: rent?.rentCollectionPaymentDate || '',
  });

  const handleSubmit = async () => {
    try {
      if (rent?.id) {
        await updateRent(rent.id, { ...form, type: defaultType });
      } else {
        await createRent({ ...form, type: defaultType });
      }
      onSuccess(rent?.id || '');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}><Text>取消</Text></TouchableOpacity>
          <Text style={modalStyles.title}>新增收租記錄</Text>
          <TouchableOpacity onPress={handleSubmit}><Text style={{ color: '#10b981' }}>保存</Text></TouchableOpacity>
        </View>

        <ScrollView style={modalStyles.form}>
          {/* 物业選擇 */}
          <Text style={modalStyles.label}>物业</Text>
          <TextInput style={modalStyles.input} value={form.propertyId} placeholder="選擇物业" />

          {/* 合約號碼 */}
          <Text style={modalStyles.label}>合約號碼</Text>
          <TextInput style={modalStyles.input} value={form.rentOutTenancyNumber}
            onChangeText={v => setForm(f => ({ ...f, rentOutTenancyNumber: v }))} placeholder="例：A01-P001-2024" />

          {/* 月租 */}
          <Text style={modalStyles.label}>月租 (HKD)</Text>
          <TextInput style={modalStyles.input} value={String(form.rentOutMonthlyRental || '')}
            onChangeText={v => setForm(f => ({ ...f, rentOutMonthlyRental: Number(v) }))}
            keyboardType="numeric" placeholder="50000" />

          {/* 期數 */}
          <Text style={modalStyles.label}>期數</Text>
          <TextInput style={modalStyles.input} value={String(form.rentOutPeriods || '')}
            onChangeText={v => setForm(f => ({ ...f, rentOutPeriods: Number(v) }))}
            keyboardType="numeric" placeholder="24" />

          {/* 租期 */}
          <Text style={modalStyles.label}>租期開始</Text>
          <TextInput style={modalStyles.input} value={form.rentOutStartDate}
            onChangeText={v => setForm(f => ({ ...f, rentOutStartDate: v }))}
            placeholder="2024-01-01" />

          <Text style={modalStyles.label}>租期結束</Text>
          <TextInput style={modalStyles.input} value={form.rentOutEndDate}
            onChangeText={v => setForm(f => ({ ...f, rentOutEndDate: v }))}
            placeholder="2025-12-31" />

          {/* 租務狀態 */}
          <Text style={modalStyles.label}>租務狀態</Text>
          <View style={modalStyles.chipRow}>
            {RENT_OUT_STATUS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[modalStyles.chip, form.rentOutStatus === opt.value && modalStyles.chipActive]}
                onPress={() => setForm(f => ({ ...f, rentOutStatus: opt.value as any }))}
              >
                <Text style={[modalStyles.chipText, form.rentOutStatus === opt.value && modalStyles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 收租記錄 */}
          <Text style={modalStyles.sectionTitle}>— 收租記錄 —</Text>

          <Text style={modalStyles.label}>收租金額 (HKD)</Text>
          <TextInput style={modalStyles.input} value={String(form.rentCollectionAmount || '')}
            onChangeText={v => setForm(f => ({ ...f, rentCollectionAmount: Number(v) }))}
            keyboardType="numeric" placeholder="50000" />

          <Text style={modalStyles.label}>付款方式</Text>
          <View style={modalStyles.chipRow}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[modalStyles.chip, form.rentCollectionPaymentMethod === m.value && modalStyles.chipActive]}
                onPress={() => setForm(f => ({ ...f, rentCollectionPaymentMethod: m.value as any }))}
              >
                <Text style={[modalStyles.chipText, form.rentCollectionPaymentMethod === m.value && modalStyles.chipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={modalStyles.label}>付款日期</Text>
          <TextInput style={modalStyles.input} value={form.rentCollectionPaymentDate}
            onChangeText={v => setForm(f => ({ ...f, rentCollectionPaymentDate: v }))}
            placeholder="2024-02-01" />
        </ScrollView>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 17, fontWeight: '600' },
  form: { flex: 1, padding: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#555', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  sectionTitle: { textAlign: 'center', color: '#aaa', marginTop: 24, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#10b981' },
  chipText: { color: '#666', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
});
```

---

## 附錄：相關檔案索引

| 用途 | 檔案路徑 |
|------|----------|
| TypeScript 介面 | `src/lib/db.ts` |
| 顯示工具函式 | `src/lib/rentPaymentDisplay.ts` |
| React Query 鉤子 | `src/hooks/useStorage.ts` |
| 收租表單元件 | `src/components/properties/RentModal.tsx` |
| 收租詳情元件 | `src/components/properties/RentDetailsModal.tsx` |
| 統計卡片元件 | `src/components/layout/BentoGrid.tsx` |
| 收租頁 | `src/app/(admin)/dashboard/rent-out/page.tsx` |
| 交租頁 | `src/app/(admin)/dashboard/renting/page.tsx` |
| 合約頁 | `src/app/(admin)/dashboard/contracts/page.tsx` |
| 管理後台側邊欄 | `src/components/layout/AdminSidebar.tsx` |
| 用戶端側邊欄 | `src/components/layout/DashboardSidebar.tsx` |
