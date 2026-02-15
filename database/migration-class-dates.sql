-- =============================================
-- MIGRATION: Class-wise Start & End Dates
-- Run this in Supabase SQL Editor
-- =============================================

-- Add classes_start_date and classes_end_date to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS classes_start_date DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS classes_end_date DATE;

-- Also add useful columns for class configuration
ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_number TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_students INT DEFAULT 60;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Set defaults from academic year for existing classes
UPDATE classes c
SET 
  classes_start_date = COALESCE(c.classes_start_date, ay.start_date),
  classes_end_date = COALESCE(c.classes_end_date, ay.end_date)
FROM academic_years ay
WHERE c.academic_year_id = ay.id
AND (c.classes_start_date IS NULL OR c.classes_end_date IS NULL);

-- Verify
SELECT c.name, c.grade, c.classes_start_date, c.classes_end_date, ay.start_date as ay_start, ay.end_date as ay_end
FROM classes c
JOIN academic_years ay ON c.academic_year_id = ay.id
ORDER BY c.name;
