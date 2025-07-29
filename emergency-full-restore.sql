-- EMERGENCY FULL RESTORE - Marc Zorjan
-- Customer ID: eeda2d3b-0ed6-4e21-b307-7b41da72c401
-- Email: marc.zorjan@gotevent.se

-- 1. Först, säkerställ att kunden är aktiv
UPDATE customers 
SET status = 'active'
WHERE id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401';

-- 2. Säkerställ att alla filer är aktiva och inte raderade
UPDATE files 
SET is_deleted = false, is_trashed = false
WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401';

-- 3. Kontrollera kund-status
SELECT 
  id,
  email, 
  name,
  status,
  created_at
FROM customers 
WHERE id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401';

-- 4. Kontrollera fil-status
SELECT 
  COUNT(*) as total_files,
  COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_files,
  COUNT(CASE WHEN is_trashed = false THEN 1 END) as not_trashed_files,
  SUM(file_size) as total_size_bytes
FROM files 
WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401';

-- 5. Visa första 5 filerna för verifiering
SELECT 
  id, 
  original_name, 
  file_size, 
  is_deleted,
  is_trashed,
  uploaded_at
FROM files 
WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'
  AND is_deleted = false
ORDER BY uploaded_at DESC
LIMIT 5;
