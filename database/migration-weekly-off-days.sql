-- =============================================
-- MIGRATION: Weekly Off Days & Working Overrides
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add weekly_off_days to institutions
-- Stores array of day numbers: 0=Sunday, 1=Monday, ... 6=Saturday
-- Default [0] means only Sunday is off
ALTER TABLE institutions 
ADD COLUMN IF NOT EXISTS weekly_off_days JSONB DEFAULT '[0]'::jsonb;

-- Set default for existing institutions (Sunday only)
UPDATE institutions 
SET weekly_off_days = '[0]'::jsonb 
WHERE weekly_off_days IS NULL;

-- 2. Update holidays table to allow 'working_override' type
-- Remove ANY existing check constraint on holiday_type, then recreate
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Find and drop all check constraints on holiday_type
  FOR r IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'holidays'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%holiday_type%'
  ) LOOP
    EXECUTE 'ALTER TABLE holidays DROP CONSTRAINT ' || r.conname;
  END LOOP;
END $$;

-- Add updated constraint allowing 'working_override'
ALTER TABLE holidays ADD CONSTRAINT holidays_holiday_type_check 
  CHECK (holiday_type IN ('public', 'institutional', 'exam', 'vacation', 'other', 'working_override'));

-- 3. Ensure unique constraint for upsert support (date range holidays)
DO $$
BEGIN
  ALTER TABLE holidays ADD CONSTRAINT holidays_institution_date_unique UNIQUE (institution_id, date);
EXCEPTION WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'institutions' AND column_name = 'weekly_off_days';
