-- Migration: Add logo support to institutions
-- Run this in Supabase SQL Editor

-- 1. Add logo_url column to institutions table
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Create a storage bucket for logos (run once)
INSERT INTO storage.buckets (id, name, public)
VALUES ('institution-logos', 'institution-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies (drop + recreate to be safe)
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
CREATE POLICY "Public read logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'institution-logos');

DROP POLICY IF EXISTS "Auth upload logos" ON storage.objects;
CREATE POLICY "Auth upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'institution-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth delete logos" ON storage.objects;
CREATE POLICY "Auth delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'institution-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth update logos" ON storage.objects;
CREATE POLICY "Auth update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'institution-logos' AND auth.role() = 'authenticated');

SELECT 'Logo support added successfully!' as result;
