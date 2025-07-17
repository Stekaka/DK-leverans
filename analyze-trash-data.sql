-- DETALJERAD PAPPERSKORG ANALYS
-- Nu när vi vet att kolumnen finns och det finns trashed files

-- 1. Visa alla filer med deras trash-status
SELECT 
    id,
    customer_id,
    original_name,
    display_name,
    is_deleted,
    is_trashed,
    uploaded_at,
    customer_folder_path
FROM files 
ORDER BY uploaded_at DESC
LIMIT 10;

-- 2. Visa bara trashed files
SELECT 
    id,
    customer_id,
    original_name,
    is_trashed,
    uploaded_at
FROM files 
WHERE is_deleted = false AND is_trashed = true
ORDER BY uploaded_at DESC;

-- 3. Visa bara normala files (inte trashed, inte deleted)
SELECT 
    id,
    customer_id,
    original_name,
    is_trashed,
    uploaded_at
FROM files 
WHERE is_deleted = false AND is_trashed = false
ORDER BY uploaded_at DESC
LIMIT 5;

-- 4. Kontrollera om det finns filer med NULL is_trashed
SELECT COUNT(*) as null_trashed_files
FROM files 
WHERE is_trashed IS NULL;

-- 5. Ta en specifik fil och se dess exakta status (byt ut customer_id)
-- SELECT * FROM files WHERE customer_id = 'DIN_CUSTOMER_ID' ORDER BY uploaded_at DESC LIMIT 3;
