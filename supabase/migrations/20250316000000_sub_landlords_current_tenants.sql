-- Migration: sub_landlords (二房東) and current_tenants (現時租客) tables
-- Admin-only data; structure mirrors rent_out contract fields

-- 二房東 (Sub-landlord)
CREATE TABLE IF NOT EXISTS sub_landlords (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    tenancy_number text,
    pricing numeric,
    monthly_rental numeric,
    periods integer,
    total_amount numeric,
    start_date date,
    end_date date,
    actual_end_date date,
    deposit_received numeric,
    deposit_receipt_number text,
    deposit_receive_date date,
    deposit_return_date date,
    deposit_return_amount numeric,
    lessor text,
    address_detail text,
    status text CHECK (status IN ('listing', 'renting', 'completed')),
    description text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sub_landlords_created_by ON sub_landlords(created_by);
CREATE INDEX IF NOT EXISTS idx_sub_landlords_is_deleted ON sub_landlords(is_deleted);

-- 現時租客 (Current tenant)
CREATE TABLE IF NOT EXISTS current_tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    tenancy_number text,
    pricing numeric,
    monthly_rental numeric,
    periods integer,
    total_amount numeric,
    start_date date,
    end_date date,
    actual_end_date date,
    deposit_received numeric,
    deposit_receipt_number text,
    deposit_receive_date date,
    deposit_return_date date,
    deposit_return_amount numeric,
    lessor text,
    address_detail text,
    status text CHECK (status IN ('listing', 'renting', 'completed')),
    description text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_current_tenants_created_by ON current_tenants(created_by);
CREATE INDEX IF NOT EXISTS idx_current_tenants_is_deleted ON current_tenants(is_deleted);

-- Add foreign key columns to rents for referencing (optional - for backward compat we keep text fields)
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_sub_landlord_id uuid;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_out_tenant_ids jsonb DEFAULT '[]'::jsonb;

-- RLS: Tables use app-level admin route protection (custom auth via app_users).
-- Add RLS policies if you migrate to Supabase Auth.
