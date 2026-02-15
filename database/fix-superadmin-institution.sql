-- =============================================
-- FIX: Set institution_id for super_admin user
-- Run this in Supabase SQL Editor if your super_admin
-- user doesn't have an institution_id set
-- =============================================

-- First, check your super_admin user:
SELECT id, full_name, email, role, institution_id 
FROM users 
WHERE role = 'super_admin';

-- Check your institutions:
SELECT id, name FROM institutions WHERE is_active = true;

-- Then update (replace the UUIDs with your actual values):
-- UPDATE users 
-- SET institution_id = 'YOUR_INSTITUTION_ID_HERE'
-- WHERE role = 'super_admin' AND institution_id IS NULL;

-- Or auto-fix: set all super_admins to the first active institution
UPDATE users 
SET institution_id = (SELECT id FROM institutions WHERE is_active = true LIMIT 1)
WHERE role = 'super_admin' AND institution_id IS NULL;
