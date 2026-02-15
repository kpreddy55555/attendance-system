-- =============================================
-- MIGRATION: Holidays Table for Reports
-- Run this in Supabase SQL Editor
-- =============================================

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  holiday_type TEXT CHECK (holiday_type IN ('public', 'institutional', 'exam', 'vacation', 'other')) DEFAULT 'public',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, date)
);

-- RLS for holidays
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_select_policy" ON holidays;
DROP POLICY IF EXISTS "holidays_insert_policy" ON holidays;
DROP POLICY IF EXISTS "holidays_update_policy" ON holidays;
DROP POLICY IF EXISTS "holidays_delete_policy" ON holidays;

CREATE POLICY "holidays_select_policy" ON holidays
  FOR SELECT USING (
    institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "holidays_insert_policy" ON holidays
  FOR INSERT WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'institution_admin')
    )
  );

CREATE POLICY "holidays_update_policy" ON holidays
  FOR UPDATE USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'institution_admin')
    )
  );

CREATE POLICY "holidays_delete_policy" ON holidays
  FOR DELETE USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'institution_admin')
    )
  );

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_holidays_institution_date ON holidays(institution_id, date);

-- =============================================
-- Ensure attendance table has is_late column
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'is_late'
  ) THEN
    ALTER TABLE attendance ADD COLUMN is_late BOOLEAN DEFAULT false;
  END IF;
END $$;
