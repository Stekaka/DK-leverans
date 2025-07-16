-- Lägg till mappstöd för filorganisering
-- Kör detta i Supabase SQL Editor för att uppdatera befintlig databas

-- 1. Lägg till folder_path kolumn till files tabell
ALTER TABLE files ADD COLUMN folder_path VARCHAR(500) DEFAULT '';

-- 2. Lägg till index för snabbare sökning i mappar
CREATE INDEX idx_files_folder_path ON files(customer_id, folder_path);

-- 3. Skapa en view för mappstruktur per kund
CREATE OR REPLACE VIEW customer_folders AS
SELECT 
  customer_id,
  CASE 
    WHEN folder_path = '' THEN 'Rot'
    ELSE folder_path 
  END as folder_name,
  COUNT(*) as file_count,
  SUM(file_size) as total_size
FROM files 
WHERE is_deleted = FALSE
GROUP BY customer_id, folder_path
ORDER BY customer_id, folder_path;

-- 4. Skapa funktion för att skapa mappstruktur automatiskt
CREATE OR REPLACE FUNCTION create_folder_structure(
  customer_uuid UUID,
  folder_name VARCHAR(500)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Kontrollera att kunden existerar
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = customer_uuid) THEN
    RAISE EXCEPTION 'Kund med ID % existerar inte', customer_uuid;
  END IF;
  
  -- Folder_path kan innehålla / för undermappar (t.ex. "Bilder/Exteriör")
  -- Ingen separat folders tabell behövs - vi använder bara folder_path i files
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. Exempel på mappstruktur som kan skapas:
-- folder_path exempel:
-- '' (tom sträng = rot)
-- 'Bilder'
-- 'Videor' 
-- 'Bilder/Exteriör'
-- 'Bilder/Interiör'
-- 'Videor/Drönare'
-- 'Videor/Tidslapse'
-- 'Dokument'

-- 6. Funktion för att flytta fil till annan mapp
CREATE OR REPLACE FUNCTION move_file_to_folder(
  file_uuid UUID,
  new_folder_path VARCHAR(500)
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE files 
  SET folder_path = new_folder_path,
      updated_at = NOW()
  WHERE id = file_uuid;
  
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Lägg till några kommentarer för förklaring
COMMENT ON COLUMN files.folder_path IS 'Sökväg till mapp, t.ex. "Bilder/Exteriör". Tom sträng = rotmapp.';
COMMENT ON VIEW customer_folders IS 'Vy som visar mappstruktur per kund med antal filer och total storlek.';

-- 8. Skapa folders tabell för att spara tomma mappar
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  folder_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, folder_path)
);

-- 9. Index för snabbare mappsökning
CREATE INDEX idx_folders_customer_id ON folders(customer_id);

-- 10. Policy för folders (samma som files)
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on folders" ON folders
  FOR ALL USING (true) WITH CHECK (true);
