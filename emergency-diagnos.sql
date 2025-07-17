-- EMERGENCY DIAGNOS - KÖR DETTA FÖRST
-- Kontrollera om files-tabellen fortfarande finns

-- 1. Kontrollera att files-tabellen finns
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'files';

-- 2. Kontrollera alla kolumner i files-tabellen
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'files' 
ORDER BY ordinal_position;

-- 3. Räkna totalt antal filer
SELECT COUNT(*) as total_files FROM files;

-- 4. Kontrollera om is_trashed kolumnen finns
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'files' AND column_name = 'is_trashed'
        ) THEN 'is_trashed kolumn finns'
        ELSE 'is_trashed kolumn SAKNAS'
    END as status;

-- 5. Visa senaste filerna (för att se om data finns kvar)
SELECT 
    id,
    original_name,
    customer_id,
    uploaded_at,
    is_deleted
FROM files 
ORDER BY uploaded_at DESC 
LIMIT 10;
