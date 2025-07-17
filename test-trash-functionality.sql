-- TEST PAPPERSKORG FUNKTIONALITET
-- Kör detta EFTER supabase-trash-support.sql

-- Kontrollera att is_trashed kolumnen finns
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'files' AND column_name = 'is_trashed';

-- Kontrollera antal filer totalt
SELECT 
    COUNT(*) as total_files,
    COUNT(*) FILTER (WHERE is_trashed = false) as active_files,
    COUNT(*) FILTER (WHERE is_trashed = true) as trashed_files,
    COUNT(*) FILTER (WHERE is_deleted = true) as deleted_files
FROM files;

-- Visa exempel på filstruktur med nya kolumner
SELECT 
    id,
    original_name,
    customer_id,
    is_deleted,
    is_trashed,
    uploaded_at
FROM files 
LIMIT 5;

-- Testa query för normala filer (inte raderade, inte i papperskorgen)
SELECT COUNT(*) as normal_files
FROM files 
WHERE is_deleted = false AND is_trashed = false;

-- Testa query för papperskorg
SELECT COUNT(*) as trash_files  
FROM files
WHERE is_deleted = false AND is_trashed = true;

-- Index-info för prestanda
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'files' 
AND indexname LIKE '%trashed%';
