-- KONTROLLERA FILES TABELLSCHEMA
-- Kör denna för att se vilka kolumner som finns i files-tabellen

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'files' 
ORDER BY ordinal_position;

-- Visa sample data för att förstå strukturen
SELECT 
    id,
    original_name,
    customer_id,
    uploaded_at,
    updated_at,
    file_size,
    file_type
FROM files 
LIMIT 5;
