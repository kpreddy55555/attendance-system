-- =============================================
-- MIGRATION: Student/Parent Authentication Support
-- Run this in Supabase SQL Editor
-- =============================================

-- Ensure students table has gr_number field (some setups use admission_number)
ALTER TABLE students ADD COLUMN IF NOT EXISTS gr_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for fast GR number + DOB lookup (student login)
CREATE INDEX IF NOT EXISTS idx_students_gr_number ON students(gr_number);
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_dob ON students(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_students_parent_phone ON students(parent_phone);

-- RLS policy: Allow anonymous read for student login verification
-- (The API uses service_role_key, so this is optional but good practice)
DO $$
BEGIN
  -- Allow service role to read students for auth
  CREATE POLICY "Service role can read students" ON students
    FOR SELECT TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Verify students table has needed columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name IN ('gr_number', 'first_name', 'last_name', 'date_of_birth', 'parent_name', 'parent_phone')
ORDER BY column_name;
