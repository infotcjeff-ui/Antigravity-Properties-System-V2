import Dexie, { type EntityTable } from 'dexie';

// Type definitions for database entities
export interface Property {
  id?: string;
  proprietorId?: string; // Legacy: single proprietor (kept for backward compatibility)
  proprietorIds?: string[]; // NEW: multiple proprietors support
  tenantId?: string;
  name: string;
  code: string;
  address: string;
  lotIndex: string; // 物業地段
  lotArea: string;
  type: 'group_asset' | 'co_investment' | 'external_lease' | 'managed_asset';
  status: 'holding' | 'renting' | 'sold' | 'suspended';
  landUse: string;
  images: string[]; // Base64 strings, max 5, total 5MB
  geoMaps: string[]; // Base64 strings, max 2
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  googleDrivePlanUrl: string;
  hasPlanningPermission: string;
  notes?: string;
  createdBy?: string; // UUID of the user who created this record
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  /** 主物業 id；有值時為子物業 */
  parentPropertyId?: string;

  // Relations
  proprietor?: Proprietor;
  tenant?: Proprietor;
  rents?: Rent[];
}

export interface Proprietor {
  id?: string;
  name: string;
  code: string; // Proprietor Code / 業主代碼 (A01, A02...)
  type: 'company' | 'individual'; // Proprietor Property / 業主性質
  category: 'group_company' | 'joint_venture' | 'managed_individual' | 'external_landlord' | 'private_company' | 'private_individual' | 'tenant'; // Proprietor Type / 擁有人類別
  englishName: string; // Proprietor English Name / 業主英文名稱
  shortName: string; // Proprietor Short Name / 業主簡稱
  /** BR Number / 商業登記號碼（對應資料庫 br_number） */
  brNumber?: string;
  createdBy?: string; // UUID of the user who created this record
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

/** 收／交租與出租合約按金等下拉共用之付款方式 */
export type RentCollectionPaymentMethod = 'cheque' | 'fps' | 'cash' | 'bank_in';

export interface Rent {
  id?: string;
  propertyId: string;
  proprietorId?: string; // Landlord/Owner (optional now)
  tenantId?: string;     // The one renting
  type: 'renting' | 'rent_out' | 'contract'; // 交租 or 收租 or 合約記錄

  // Legacy fields (kept for backward compatibility)
  location?: string; // 租借位置
  amount?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'pending' | 'completed' | 'cancelled';
  notes?: string;

  // ===== RENT OUT (收租) Fields =====
  rentOutTenancyNumber?: string;       // 出租合約號碼 *
  rentOutPricing?: number;             // 出租合約放盤價
  rentOutMonthlyRental?: number;       // 出租合約月租 *
  rentOutPeriods?: number;             // 出租合約期數
  rentOutTotalAmount?: number;         // 出租合約總額
  rentOutStartDate?: Date;             // 出租合約開始日期
  rentOutEndDate?: Date;               // 出租合約結束日期
  rentOutActualEndDate?: Date;         // 出租合約實際結束日期
  rentOutDepositReceived?: number;     // 出租合約按金（舊：金額；新表單改以 rentOutDepositPaymentMethod 為主）
  /** 出租合約按金收取方式（與付款方式選項一致，含 入數） */
  rentOutDepositPaymentMethod?: RentCollectionPaymentMethod;
  rentOutDepositReceiptNumber?: string; // 按金收據號碼
  rentOutDepositReceiveDate?: Date;    // 出租合約按金收取日期
  rentOutDepositReturnDate?: Date;     // 出租合約按金退回日期
  rentOutDepositReturnAmount?: number; // 出租合約按金退回金額
  rentOutLessor?: string;              // 出租合約出租人
  rentOutAddressDetail?: string;       // 出租合約地址資料
  rentOutStatus?: 'listing' | 'renting' | 'leasing_in' | 'completed'; // 放盤中、出租中、租入中、已完租
  rentOutDescription?: string;         // 出租合約描述 (rich text)
  rentOutSubLandlord?: string;         // 二房東 (legacy display name)
  rentOutSubLandlordId?: string;      // 二房東 (FK to sub_landlords)
  rentOutTenants?: string[];          // 現時租客 legacy (names)
  rentOutTenantIds?: string[];         // 現時租客 (FKs to current_tenants)

  /** 收租記錄（rent_out 簡化表單） */
  rentCollectionTenantName?: string;
  /** 收／交租記錄期間開始（與 startDate 同步寫入簡化表單） */
  rentCollectionDate?: Date;
  rentCollectionAmount?: number;
  rentCollectionPaymentMethod?: RentCollectionPaymentMethod;
  rentCollectionChequeBank?: string;
  rentCollectionChequeNumber?: string;
  /** 支票影像（base64 data URL） */
  rentCollectionChequeImage?: string;
  /** 付款日期（入數時填寫） */
  rentCollectionPaymentDate?: Date;
  /** 入數憑證／截圖（base64 data URL） */
  rentCollectionBankInImage?: string;

  // ===== RENTING (交租) Fields =====
  rentingNumber?: string;              // 我方租約號碼
  rentingReferenceNumber?: string;     // 對方租約號碼
  rentingMonthlyRental?: number;       // 每月租金金額
  rentingPeriods?: number;             // 租賃期限
  rentingStartDate?: Date;             // 租期開始日期
  rentingEndDate?: Date;               // 租期結束日期
  rentingDeposit?: number;             // 押金

  // ===== CONTRACT (合約記錄) Fields =====
  contractNumber?: string;             // 合約編號
  contractType?: 'sale' | 'purchase' | 'management' | 'other'; // 合約類型
  contractTitle?: string;              // 合約標題
  contractParties?: string;            // 合約各方
  contractValue?: number;              // 合約金額
  contractCurrency?: string;           // 貨幣
  contractStartDate?: Date;            // 合約開始日期
  contractEndDate?: Date;              // 合約結束日期
  contractStatus?: 'active' | 'pending' | 'completed' | 'cancelled' | 'expired';
  contractDescription?: string;         // 合約描述/備註
  contractDocumentUrl?: string;        // 合約文件連結

  createdBy?: string; // UUID of the user who created this record
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;

  // Relations
  property?: Property;
  proprietor?: Proprietor;
  tenant?: Proprietor;
}

/** 二房東 (Sub-landlord) - admin-managed, mirrors rent_out contract fields */
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
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

/** 現時租客 (Current tenant) - admin-managed, mirrors rent_out contract fields */
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
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

// Dexie Database Class
class PropertyManagementDB extends Dexie {
  properties!: EntityTable<Property, 'id'>;
  proprietors!: EntityTable<Proprietor, 'id'>;
  rents!: EntityTable<Rent, 'id'>;

  constructor() {
    super('PropertyManagementDB');

    this.version(3).stores({
      properties: 'id, proprietorId, tenantId, name, code, type, status, landUse, createdBy, createdAt',
      proprietors: 'id, name, code, category, createdBy, createdAt',
      rents: 'id, propertyId, proprietorId, tenantId, type, status, startDate, endDate, createdBy, createdAt'
    });

    this.on('ready', () => {
      console.log('IndexedDB (PropertyManagementDB) is ready');
    });
  }
}

// Create and export the database instance
export const db = new PropertyManagementDB();

// Helper function to generate UUID
export const generateId = (): string => {
  return crypto.randomUUID();
};
