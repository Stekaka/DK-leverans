-- SNABB PAPPERSKORG DEBUG
-- Kör detta i Supabase SQL Editor för att kontrollera och fixa is_trashed

-- 1. Kontrollera om is_trashed kolumnen finns
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'files' AND column_name = 'is_trashed';

-- 2. Om kolumnen INTE finns, lägg till den (kör detta först)
-- ALTER TABLE files ADD COLUMN IF NOT EXISTS is_trashed boolean DEFAULT false;

-- 3. Kontrollera befintliga filer
SELECT 
    COUNT(*) as total_files,
    COUNT(*) FILTER (WHERE is_trashed = true) as trashed_files,
    COUNT(*) FILTER (WHERE is_trashed = false OR is_trashed IS NULL) as normal_files
FROM files;

-- 4. Uppdatera NULL-värden till false (om kolumnen precis lades till)
-- UPDATE files SET is_trashed = false WHERE is_trashed IS NULL;

-- 5. Kontrollera specifik fil som vi just testade
SELECT id, original_name, is_trashed, is_deleted, customer_id, uploaded_at
FROM files 
WHERE id = '543c1d10-b840-4cd0-8e45-a14540efcb0a';

-- 6. Kontrollera om den finns bland trashed files
SELECT COUNT(*) as found_in_trash
FROM files 
WHERE id = '543c1d10-b840-4cd0-8e45-a14540efcb0a' 
AND is_trashed = true 
AND is_deleted = false;
