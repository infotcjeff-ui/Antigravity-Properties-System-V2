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

  // Relations
  proprietor?: Proprietor;
  tenant?: Proprietor;
  rents?: Rent[];
}

export interface Proprietor {
  id?: string;
  name: string;
  code: string; // Proprietor Code / 擁有方代碼 (A01, A02...)
  type: 'company' | 'individual'; // Proprietor Property / 擁有方性質
  category: 'group_company' | 'joint_venture' | 'managed_individual' | 'external_landlord' | 'tenant'; // Proprietor Type / 擁有人類別
  englishName: string; // Proprietor English Name / 擁有方英文名稱
  shortName: string; // Proprietor Short Name / 擁有方簡稱
  createdBy?: string; // UUID of the user who created this record
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export interface Rent {
  id?: string;
  propertyId: string;
  proprietorId?: string; // Landlord/Owner (optional now)
  tenantId?: string;     // The one renting
  type: 'renting' | 'rent_out'; // 交租 or 收租

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
  rentOutDepositReceived?: number;     // 出租合約按金
  rentOutDepositReceiptNumber?: string; // 按金收據號碼
  rentOutDepositReceiveDate?: Date;    // 出租合約按金收取日期
  rentOutDepositReturnDate?: Date;     // 出租合約按金退回日期
  rentOutDepositReturnAmount?: number; // 出租合約按金退回金額
  rentOutLessor?: string;              // 出租合約出租人
  rentOutAddressDetail?: string;       // 出租合約地址資料
  rentOutStatus?: 'listing' | 'renting' | 'completed'; // 放盤中、出租中、已完租
  rentOutDescription?: string;         // 出租合約描述 (rich text)
  rentOutSubLandlord?: string;         // 二房東 (legacy display name)
  rentOutSubLandlordId?: string;      // 二房東 (FK to sub_landlords)
  rentOutTenants?: string[];          // 現時租客 legacy (names)
  rentOutTenantIds?: string[];         // 現時租客 (FKs to current_tenants)

  // ===== RENTING (交租) Fields =====
  rentingNumber?: string;              // 我方租約號碼
  rentingReferenceNumber?: string;     // 對方租約號碼
  rentingMonthlyRental?: number;       // 每月租金金額
  rentingPeriods?: number;             // 租賃期限
  rentingStartDate?: Date;             // 租期開始日期
  rentingEndDate?: Date;               // 租期結束日期
  rentingDeposit?: number;             // 押金

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
  status?: 'listing' | 'renting' | 'completed';
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
  status?: 'listing' | 'renting' | 'completed';
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
