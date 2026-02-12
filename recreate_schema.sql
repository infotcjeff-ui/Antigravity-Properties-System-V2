-- ==== COMPLETE SCHEMA RECREATION ====
-- Run this script in your Supabase SQL Editor to restore the database structure.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create app_users table (RBAC)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create proprietors table
CREATE TABLE IF NOT EXISTS proprietors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT,
    type TEXT DEFAULT 'company',
    category TEXT DEFAULT 'group_company',
    english_name TEXT,
    short_name TEXT,
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT,
    type TEXT,
    status TEXT,
    address TEXT,
    lot_index TEXT,
    lot_area TEXT,
    land_use TEXT,
    images JSONB DEFAULT '[]'::JSONB,
    geo_maps JSONB DEFAULT '[]'::JSONB,
    location JSONB,
    google_drive_plan_url TEXT,
    has_planning_permission TEXT,
    notes TEXT,
    proprietor_id UUID REFERENCES proprietors(id),
    tenant_id UUID REFERENCES proprietors(id),
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create rents table
CREATE TABLE IF NOT EXISTS rents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    proprietor_id UUID REFERENCES proprietors(id),
    tenant_id UUID REFERENCES proprietors(id),
    type TEXT,
    amount NUMERIC,
    currency TEXT DEFAULT 'HKD',
    status TEXT DEFAULT 'active',
    location TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- RENT OUT fields
    rent_out_tenancy_number TEXT,
    rent_out_pricing NUMERIC,
    rent_out_monthly_rental NUMERIC,
    rent_out_periods INTEGER,
    rent_out_total_amount NUMERIC,
    rent_out_start_date TIMESTAMP WITH TIME ZONE,
    rent_out_end_date TIMESTAMP WITH TIME ZONE,
    rent_out_actual_end_date TIMESTAMP WITH TIME ZONE,
    rent_out_deposit_received NUMERIC,
    rent_out_deposit_receive_date TIMESTAMP WITH TIME ZONE,
    rent_out_deposit_return_date TIMESTAMP WITH TIME ZONE,
    rent_out_deposit_return_amount NUMERIC,
    rent_out_lessor TEXT,
    rent_out_address_detail TEXT,
    rent_out_status TEXT DEFAULT 'listing',
    rent_out_description TEXT,
    
    -- RENTING fields
    renting_number TEXT,
    renting_reference_number TEXT,
    renting_monthly_rental NUMERIC,
    renting_periods INTEGER,
    renting_start_date TIMESTAMP WITH TIME ZONE,
    renting_end_date TIMESTAMP WITH TIME ZONE,
    renting_deposit NUMERIC,
    
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Set up Row Level Security (RLS) - Global Access for simplicity
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietors ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global Access" ON app_users;
CREATE POLICY "Global Access" ON app_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Global Access" ON proprietors;
CREATE POLICY "Global Access" ON proprietors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Global Access" ON properties;
CREATE POLICY "Global Access" ON properties FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Global Access" ON rents;
CREATE POLICY "Global Access" ON rents FOR ALL USING (true) WITH CHECK (true);

-- 6. Create initial admin user
-- Password: admin (Plain text for now, should be hashed in production if using Auth)
INSERT INTO app_users (username, password, role)
VALUES ('admin', 'admin', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 7. Notification
NOTIFY pgrst, 'reload schema';
