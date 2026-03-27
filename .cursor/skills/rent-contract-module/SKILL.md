---
name: rent-contract-module
description: >
  物業交租、收租及合約模組開發指南。涵蓋 rents 表三種業務類型（交租/renting、收租/rent_out、合約/contract）的頁面結構、API 設計、UI 元件、資料模型與佈局規範。
  當用戶要求開發租務相關功能、實現 App 版交租收租頁面、或需要參考現有 Web 版實作時使用此技能。
---

# 物業租務模組開發指南

## 模組概覽

本系統租務模組以 `rents` 表為核心，通過 `type` 欄位區分三種業務場景：

| type 值 | 業務場景 | 頁面路由 (Web) | 主要用戶角色 |
|---------|---------|----------------|-------------|
| `renting` | 交租（租客向業主繳租）| `/admin/renting` | 租客 |
| `rent_out` | 收租（業主向租客收租）| `/admin/rent-out` | 業主/管理員 |
| `contract` | 合約記錄 | `/admin/contracts` | 雙方 |

> **重要**：三種 type 共享同一張 `rents` 表，但使用不同的欄位群（column groups）。

---

## 頁面架構

### 頁面路由對照

```
/admin/renting          — 交租管理（管理後台）
/admin/rent-out         — 收租管理（管理後台）
/admin/contracts       — 合約管理（管理後台）
/rent-out               — 收租 + 合約一體頁（用戶端）
```

### 頁面佈局規範

所有列表頁採用以下佈局結構：

```
┌─────────────────────────────────────────────────────────┐
│  PageHeader: 標題 + 描述文字 + 新增按鈕                   │
├─────────────────────────────────────────────────────────┤
│  FilterBar: Tab 切換 / 狀態篩選 / 日期範圍 / 搜尋框       │
├─────────────────────────────────────────────────────────┤
│  StatsRow: BentoGrid 統計卡片（總數、已付/未付、逾期等）   │
├─────────────────────────────────────────────────────────┤
│  DataTable: 排序 + 分頁 + 行操作（檢視/編輯/刪除）        │
├─────────────────────────────────────────────────────────┤
│  DetailModal / FormModal: 詳情檢視 / 表單編輯 overlay     │
└─────────────────────────────────────────────────────────┘
```

---

## UI 元件清單

### 核心元件

| 元件名 | 檔案路徑 | 用途 | 備註 |
|--------|---------|------|------|
| `RentModal` | `src/components/properties/RentModal.tsx` | 交租/收租/合約表單（~1600 行）| 最重要，含所有業務欄位 |
| `RentDetailsModal` | `src/components/properties/RentDetailsModal.tsx` | 詳情檢視 overlay | 唯讀顯示 |
| `RentOutFormModal` | `src/components/properties/RentOutFormModal.tsx` | 二房東/現時租客管理 | |
| `BentoCard` | `src/components/layout/BentoGrid.tsx` | 統計數字卡片 | 含 dark mode 樣式 |

### 列表頁元件模式

每個列表頁的典型元件組合：

```tsx
// 典型列表頁結構
<PageHeader title="收租管理" description="管理物业的租金收入与合约记录">
  <motion.button onClick={() => openCreateModal()}>新增記錄</motion.button>
</PageHeader>

<Tabs value={tab} onChange={setTab}>
  <Tabs.List>
    <Tabs.Trigger value="rents">租金記錄</Tabs.Trigger>
    <Tabs.Trigger value="contracts">合約記錄</Tabs.Trigger>
  </Tabs.List>
</Tabs>

<StatsRow>
  <BentoCard label="總記錄" value={total} />
  <BentoCard label="已付" value={paid} color="green" />
  <BentoCard label="未付" value={unpaid} color="red" />
</StatsRow>

<DataTable columns={columns} data={filteredData} pagination />

<RentModal
  open={modalOpen}
  defaultType="rent_out"
  propertyId={selectedPropertyId}
  onClose={() => setModalOpen(false)}
  onSuccess={(rentId) => { invalidate(); }}
/>
```

---

## 資料模型

### rents 表核心欄位群

#### 通用欄位（所有 type 都有）

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | UUID | 主鍵 |
| `property_id` | UUID | 關聯物业 |
| `proprietor_id` | UUID | 業主（proprietors FK）|
| `tenant_id` | UUID | 租客（proprietors FK）|
| `type` | TEXT | `renting` / `rent_out` / `contract` |
| `amount` | NUMERIC | 總金額 |
| `currency` | TEXT | 默認 `HKD` |
| `status` | TEXT | 狀態 |
| `start_date` | TIMESTAMPTZ | 開始日期 |
| `end_date` | TIMESTAMPTZ | 結束日期 |
| `notes` | TEXT | 備註 |

#### 收租 (rent_out) 欄位群

| 欄位 (DB) | 對應 TypeScript | 說明 |
|-----------|----------------|------|
| `rent_out_tenancy_number` | `rentOutTenancyNumber` | 出租合約號碼 |
| `rent_out_pricing` | `rentOutPricing` | 放盤價 |
| `rent_out_monthly_rental` | `rentOutMonthlyRental` | 月租 |
| `rent_out_periods` | `rentOutPeriods` | 期數 |
| `rent_out_total_amount` | `rentOutTotalAmount` | 總額 |
| `rent_out_start_date` | `rentOutStartDate` | 合約開始 |
| `rent_out_end_date` | `rentOutEndDate` | 合約結束 |
| `rent_out_deposit_received` | `rentOutDepositReceived` | 按金 |
| `rent_out_deposit_payment_method` | `rentOutDepositPaymentMethod` | 按金付款方式 |
| `rent_out_deposit_receipt_number` | `rentOutDepositReceiptNumber` | 按金收據號 |
| `rent_out_deposit_receive_date` | `rentOutDepositReceiveDate` | 按金收取日期 |
| `rent_out_deposit_return_date` | `rentOutDepositReturnDate` | 按金退回日期 |
| `rent_out_lessor` | `rentOutLessor` | 出租人 |
| `rent_out_status` | `rentOutStatus` | `listing` / `renting` / `leasing_in` / `completed` |
| `rent_out_sub_landlord_id` | `rentOutSubLandlordId` | 二房東 FK |
| `rent_out_tenant_ids` | `rentOutTenantIds` | 現時租客 IDs (JSONB) |

#### 交租 (renting) 欄位群

| 欄位 (DB) | 對應 TypeScript | 說明 |
|-----------|----------------|------|
| `renting_number` | `rentingNumber` | 我方租約號碼 |
| `renting_reference_number` | `rentingReferenceNumber` | 對方租約號碼 |
| `renting_monthly_rental` | `rentingMonthlyRental` | 每月租金 |
| `renting_periods` | `rentingPeriods` | 期限 |
| `renting_start_date` | `rentingStartDate` | 租期開始 |
| `renting_end_date` | `rentingEndDate` | 租期結束 |
| `renting_deposit` | `rentingDeposit` | 押金 |

#### 收租記錄 (rent_collection) 欄位群

| 欄位 (DB) | 對應 TypeScript | 說明 |
|-----------|----------------|------|
| `rent_collection_tenant_name` | `rentCollectionTenantName` | 租客名稱 |
| `rent_collection_date` | `rentCollectionDate` | 收租日期 |
| `rent_collection_amount` | `rentCollectionAmount` | 收租金額 |
| `rent_collection_payment_method` | `rentCollectionPaymentMethod` | 付款方式 |
| `rent_collection_cheque_bank` | `rentCollectionChequeBank` | 支票銀行 |
| `rent_collection_cheque_number` | `rentCollectionChequeNumber` | 支票號碼 |
| `rent_collection_payment_date` | `rentCollectionPaymentDate` | 付款日期 |

#### 合約 (contract) 欄位群

| 欄位 (DB) | 對應 TypeScript | 說明 |
|-----------|----------------|------|
| `contract_number` | `contractNumber` | 合約編號 |
| `contract_type` | `contractType` | `sale` / `purchase` / `management` / `other` |
| `contract_title` | `contractTitle` | 合約標題 |
| `contract_parties` | `contractParties` | 合約各方 |
| `contract_value` | `contractValue` | 合約金額 |
| `contract_currency` | `contractCurrency` | 貨幣 |
| `contract_start_date` | `contractStartDate` | 開始日期 |
| `contract_end_date` | `contractEndDate` | 結束日期 |
| `contract_status` | `contractStatus` | `active` / `pending` / `completed` / `cancelled` / `expired` |
| `contract_description` | `contractDescription` | 描述 |
| `contract_document_url` | `contractDocumentUrl` | 文件連結 |

---

## API 設計

### 查詢鉤子

所有前端數據獲取通過 React Query 鉤子：

```typescript
// src/hooks/useStorage.ts
useRentsWithRelationsQuery(options?: { type?: 'renting' | 'rent_out' | 'contract' })

// 查詢 key: ['rents-with-relations', userId, type]
// staleTime: 2 分鐘
```

### Supabase 查詢模式

```typescript
// 查詢所有 rents（指定 type）
supabase
  .from('rents')
  .select(`*, property:properties(*), proprietor:proprietors!proprietor_id(*), tenant:proprietors!tenant_id(*)`)
  .eq('type', 'rent_out')
  .order('created_at', { ascending: false })

// 查詢某物业的所有租務記錄
supabase
  .from('rents')
  .select('*')
  .eq('property_id', propertyId)
  .in('type', ['rent_out', 'contract'])
```

### CRUD 操作

```typescript
// 新增
supabase.from('rents').insert({ ...formData, type: 'rent_out' })

// 更新
supabase.from('rents').update({ ...formData }).eq('id', rentId)

// 刪除（軟刪除）
supabase.from('rents').update({ is_deleted: true, deleted_at: new Date() }).eq('id', rentId)
```

---

## 付款方式

```typescript
type RentCollectionPaymentMethod = 'cheque' | 'fps' | 'cash' | 'bank_in'

const paymentMethodLabels = {
  cheque: '支票',
  fps: 'FPS轉帳',
  cash: '現金',
  bank_in: '入數',
}
```

---

## 狀態色彩系統

每個業務類型有專屬狀態色彩（Tailwind）：

```typescript
// 收租狀態 (rent_out_status)
const rentOutStatusColors = {
  listing:    'bg-purple-500/20 text-purple-400',   // 放盤中
  renting:    'bg-green-500/20 text-green-400',     // 出租中
  leasing_in: 'bg-cyan-500/20 text-cyan-400',      // 租入中
  completed:  'bg-blue-500/20 text-blue-400',       // 已完租
}

// 合約狀態 (contract_status)
const contractStatusColors = {
  active:    'bg-green-500/20 text-green-400',
  pending:   'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
  expired:   'bg-zinc-500/20 text-zinc-400',
}

// 收租記錄狀態
type RentCollectionPayListStatus = 'paid' | 'unpaid'
// unpaid: 紅色 | paid: 綠色
```

---

## 日期工具函式

```typescript
// src/lib/rentPaymentDisplay.ts
formatDateDMY(value: Date | string | undefined | null): string      // DD/MM/YYYY
formatDateRangeDMY(start, end, sep = ' 至 '): string                    // 帶連接符的日期範圍
isPeriodEndExpired(end): boolean                                        // 租期是否已過
getRentCollectionPayListStatus(rent): 'paid' | 'unpaid'                // 繳付狀態
hasRentCollectionPaidAmount(rent): boolean                              // 是否有已付款金額
```

---

## 詳細參考文檔

如需完整的程式碼範例、元件實作細節、頁面完整代碼、TypeScript 介面定義，請見：

- [reference.md](reference.md) — 完整程式碼範例、完整欄位列表、頁面完整代碼

---

## App 開發重點提示

### 必須實現的功能

1. **三個獨立 Tab**：交租 / 收租 / 合約（或底部 Tab 導航）
2. **狀態過期提示**：租期結束日 < 今天時顯示紅色標籤
3. **付款記錄**：每次付款新增一條 `rent_collection_*` 記錄
4. **統計卡片**：顯示總數、已收/未收、逾期筆數
5. **二房東關聯**：`rent_out_sub_landlord_id` 連結 sub_landlords 表

### Mobile-first 設計考量

- 列表頁使用卡片式佈局替代桌面端 DataTable
- Form Modal 改為全屏表單頁
- 底部固定操作欄（保存/取消）
- 狀態篩選改為下拉選單
- 支援離線緩存（React Query offline persistence）
