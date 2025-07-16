-- ENKEL ACCESS-CHECK UTAN FUNKTIONER
-- Kör denna för att testa grundläggande access-kontroll

-- 1. Kontrollera alla kunder och deras access-status
SELECT 
    id,
    name,
    email,
    project,
    status,
    access_expires_at,
    total_storage_used,
    CASE 
        WHEN access_expires_at IS NULL THEN 'INGEN_TIMER'
        WHEN access_expires_at > NOW() THEN 'AKTIV'
        ELSE 'UTGÅNGEN'
    END as access_status,
    CASE 
        WHEN access_expires_at IS NULL THEN NULL
        WHEN access_expires_at > NOW() THEN EXTRACT(DAYS FROM access_expires_at - NOW())::INTEGER
        ELSE 0
    END as days_remaining
FROM customers
ORDER BY name;

-- 2. Kontrollera om access-relaterade tabeller finns
SELECT table_name
FROM information_schema.tables 
WHERE table_name IN ('permanent_access_purchases', 'access_extension_logs')
AND table_schema = 'public';

-- 3. Kontrollera om access-kolumner finns i customers-tabellen
SELECT column_name
FROM information_schema.columns 
WHERE table_name = 'customers' 
AND column_name IN ('access_expires_at', 'total_storage_used');
