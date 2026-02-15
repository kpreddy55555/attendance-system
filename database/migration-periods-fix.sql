-- =============================================
-- MIGRATION: Fix Periods Table & RLS Policies
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Create the periods table (if not exists)
CREATE TABLE IF NOT EXISTS periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  period_code TEXT NOT NULL,
  period_name TEXT NOT NULL,
  time_from TIME NOT NULL,
  time_to TIME NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, period_code)
);

-- Step 2: Enable RLS on the periods table
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "periods_select_policy" ON periods;
DROP POLICY IF EXISTS "periods_insert_policy" ON periods;
DROP POLICY IF EXISTS "periods_update_policy" ON periods;
DROP POLICY IF EXISTS "periods_delete_policy" ON periods;

-- Step 4: Create RLS policies

-- SELECT: All authenticated users from the same institution can read periods
CREATE POLICY "periods_select_policy" ON periods
  FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- INSERT: Only super_admin and institution_admin can create periods
CREATE POLICY "periods_insert_policy" ON periods
  FOR INSERT
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'institution_admin')
    )
  );

-- UPDATE: Only super_admin and institution_admin can update periods
CREATE POLICY "periods_update_policy" ON periods
  FOR UPDATE
  USING (
    institution_id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'institution_admin')
    )
  );

-- DELETE: Only super_admin and institution_admin can delete periods
CREATE POLICY "periods_delete_policy" ON periods
  FOR DELETE
  USING (
    institution_id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'institution_admin')
    )
  );

-- Step 5: Also ensure lecture_sessions and lecture_attendance have proper RLS

-- lecture_sessions RLS
ALTER TABLE lecture_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture_sessions_select_policy" ON lecture_sessions;
DROP POLICY IF EXISTS "lecture_sessions_insert_policy" ON lecture_sessions;

CREATE POLICY "lecture_sessions_select_policy" ON lecture_sessions
  FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "lecture_sessions_insert_policy" ON lecture_sessions
  FOR INSERT
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- lecture_attendance RLS
ALTER TABLE lecture_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture_attendance_select_policy" ON lecture_attendance;
DROP POLICY IF EXISTS "lecture_attendance_insert_policy" ON lecture_attendance;

CREATE POLICY "lecture_attendance_select_policy" ON lecture_attendance
  FOR SELECT
  USING (
    lecture_session_id IN (
      SELECT id FROM lecture_sessions 
      WHERE institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "lecture_attendance_insert_policy" ON lecture_attendance
  FOR INSERT
  WITH CHECK (
    lecture_session_id IN (
      SELECT id FROM lecture_sessions 
      WHERE institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =============================================
-- VERIFY: Run this to check everything is set up
-- =============================================
-- SELECT * FROM periods;
-- SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('periods', 'lecture_sessions', 'lecture_attendance');
