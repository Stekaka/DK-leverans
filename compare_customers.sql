
-- Jämför Niklas (fungerar) med Marc (fungerar inte)

-- 1. Niklas customer info
SELECT id, email, name, status, created_at, password_hash IS NOT NULL as has_password
FROM customers 
WHERE email = 'niklas@dronarkompaniet.se';

-- 2. Marc customer info  
SELECT id, email, name, status, created_at, password_hash IS NOT NULL as has_password
FROM customers 
WHERE email = 'marc.zorjan@gotevent.se';

-- 3. Niklas fil-räkning
SELECT COUNT(*) as total_files, 
       COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_files
FROM files 
WHERE customer_id = (SELECT id FROM customers WHERE email = 'niklas@dronarkompaniet.se');

-- 4. Marc fil-räkning
SELECT COUNT(*) as total_files,
       COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_files  
FROM files
WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401';

