-- KONTROLLERA ACCESS-TABELLER OCH FUNKTIONER
-- Kör denna för att se om access-systemet är korrekt installerat

-- 1. Kontrollera vilka tabeller som finns
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_name IN ('customers', 'permanent_access_purchases', 'access_extension_logs')
ORDER BY table_name;

-- 2. Kontrollera customers-tabellens kolumner
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'customers' 
ORDER BY ordinal_position;

-- 3. Kontrollera om check_customer_access funktionen finns
SELECT proname, proargnames, prosrc
FROM pg_proc 
WHERE proname = 'check_customer_access';

-- 4. Testa access-funktionen med första kunden
SELECT id, name, access_expires_at, total_storage_used 
FROM customers 
LIMIT 1;

-- 5. Kör access-check för första kunden (ersätt UUID med verklig customer ID)
-- SELECT * FROM check_customer_access('CUSTOMER_UUID_HERE');
