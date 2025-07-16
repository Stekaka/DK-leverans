-- DEBUGGING: Kontrollera databas-schemat och innehåll
-- Kör denna i Supabase SQL Editor för att diagnostisera problemet

-- 1. Kontrollera att alla kolumner finns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'files' 
AND column_name IN ('customer_rating', 'customer_notes', 'rating_updated_at', 'display_name', 'customer_folder_path')
ORDER BY column_name;

-- 2. Visa sample data från files-tabellen
SELECT 
    id,
    original_name,
    customer_rating,
    CASE 
        WHEN customer_notes IS NULL THEN 'NULL'
        WHEN customer_notes = '' THEN 'EMPTY'
        ELSE 'HAS_CONTENT'
    END as notes_status,
    rating_updated_at,
    created_at
FROM files 
LIMIT 5;

-- 3. Räkna filer per betyg
SELECT 
    customer_rating,
    COUNT(*) as count
FROM files 
GROUP BY customer_rating
ORDER BY customer_rating;

-- 4. Kontrollera vilka filer som har kommentarer
SELECT 
    COUNT(*) as total_files,
    COUNT(customer_notes) as files_with_notes,
    COUNT(CASE WHEN customer_notes IS NOT NULL AND customer_notes != '' THEN 1 END) as files_with_content
FROM files;
