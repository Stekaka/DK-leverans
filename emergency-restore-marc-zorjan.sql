-- EMERGENCY RESTORE: Återställa alla filer för marc.zorjan@gotevent.se
-- Customer ID: eeda2d3b-0ed6-4e21-b307-7b41da72c401

-- Återställ ALLA filer för denna kund
UPDATE files 
SET is_deleted = false
WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401' 
  AND is_deleted = true;

-- Kontrollera resultatet
SELECT 
  COUNT(*) as total_files,
  COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_files,
  COUNT(CASE WHEN is_deleted = true THEN 1 END) as deleted_files,
  SUM(file_size) as total_size_bytes
FROM files 
WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401';

-- Visa första 10 filerna för verifiering
SELECT 
  id, 
  original_name, 
  file_size, 
  is_deleted, 
  uploaded_at
FROM files 
WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401'
ORDER BY uploaded_at DESC
LIMIT 10;
