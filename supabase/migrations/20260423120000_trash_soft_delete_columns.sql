-- Migration: Add soft-delete columns + RLS policies for Trash (垃圾桶) management
-- Fixes: "Failed to empty trash for proprietors: {}"
-- Run in: Supabase SQL Editor

-- ========================
-- 1. Add soft-delete columns
-- ========================

-- Proprietors
ALTER TABLE proprietors ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE proprietors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_proprietors_is_deleted ON proprietors(is_deleted);

-- Properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_properties_is_deleted ON properties(is_deleted);

-- Rents
ALTER TABLE rents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE rents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_rents_is_deleted ON rents(is_deleted);

-- ========================
-- 2. Ensure RLS: Replace existing policies with complete "Global Access" for ALL operations
-- (SELECT, INSERT, UPDATE, DELETE). This fixes the empty trash error where only SELECT was allowed.
-- ========================

ALTER TABLE proprietors ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rents ENABLE ROW LEVEL SECURITY;

-- Proprietors
DROP POLICY IF EXISTS "Global Access" ON proprietors;
CREATE POLICY "Global Access" ON proprietors FOR ALL USING (true) WITH CHECK (true);

-- Properties
DROP POLICY IF EXISTS "Global Access" ON properties;
CREATE POLICY "Global Access" ON properties FOR ALL USING (true) WITH CHECK (true);

-- Rents
DROP POLICY IF EXISTS "Global Access" ON rents;
CREATE POLICY "Global Access" ON rents FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
