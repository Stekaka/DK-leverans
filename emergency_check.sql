SELECT COUNT(*) as total_files, COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_files FROM files WHERE customer_id = 'eeda2d3b-0ed6-4e21-b307-7b41da72c401';
