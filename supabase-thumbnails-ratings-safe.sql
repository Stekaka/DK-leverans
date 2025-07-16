-- Uppdatera thumbnail och betygsättningsstöd (säker version)
-- Kör detta i Supabase SQL Editor för att uppdatera befintlig databas

-- 1. Lägg till kolumner endast om de inte redan finns
DO $$ 
BEGIN
    -- Lägg till thumbnail_url om den inte finns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'thumbnail_url') THEN
        ALTER TABLE files ADD COLUMN thumbnail_url VARCHAR(500);
    END IF;
    
    -- Lägg till customer_rating om den inte finns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'customer_rating') THEN
        ALTER TABLE files ADD COLUMN customer_rating VARCHAR(20) DEFAULT 'unrated' CHECK (customer_rating IN ('unrated', 'favorite', 'good', 'poor'));
    END IF;
    
    -- Lägg till customer_notes om den inte finns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'customer_notes') THEN
        ALTER TABLE files ADD COLUMN customer_notes TEXT;
    END IF;
    
    -- Lägg till rating_updated_at om den inte finns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'rating_updated_at') THEN
        ALTER TABLE files ADD COLUMN rating_updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Skapa index för snabbare sökning på rating (om det inte redan finns)
CREATE INDEX IF NOT EXISTS idx_files_customer_rating ON files(customer_id, customer_rating);

-- 3. Uppdatera customer_folders view för att inkludera rating statistik
-- Först ta bort befintlig view för att undvika konflikter
DROP VIEW IF EXISTS customer_folders;

-- Skapa ny view med rating statistik
CREATE VIEW customer_folders AS
SELECT 
  customer_id,
  CASE 
    WHEN folder_path = '' THEN 'Rot'
    ELSE folder_path 
  END as folder_name,
  folder_path,
  COUNT(*) as file_count,
  SUM(file_size) as total_size,
  COUNT(CASE WHEN customer_rating = 'favorite' THEN 1 END) as favorites_count,
  COUNT(CASE WHEN customer_rating = 'good' THEN 1 END) as good_count,
  COUNT(CASE WHEN customer_rating = 'poor' THEN 1 END) as poor_count,
  COUNT(CASE WHEN customer_rating = 'unrated' THEN 1 END) as unrated_count
FROM files 
WHERE is_deleted = FALSE
GROUP BY customer_id, folder_path
ORDER BY customer_id, folder_path;

-- 4. Funktion för att uppdatera filbetyg
CREATE OR REPLACE FUNCTION update_file_rating(
  file_uuid UUID,
  new_rating VARCHAR(20),
  notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Validera rating
  IF new_rating NOT IN ('unrated', 'favorite', 'good', 'poor') THEN
    RAISE EXCEPTION 'Ogiltigt betyg: %. Tillåtna värden: unrated, favorite, good, poor', new_rating;
  END IF;
  
  UPDATE files 
  SET customer_rating = new_rating,
      customer_notes = COALESCE(notes, customer_notes),
      rating_updated_at = NOW()
  WHERE id = file_uuid;
  
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Funktion för att sätta thumbnail URL
CREATE OR REPLACE FUNCTION update_file_thumbnail(
  file_uuid UUID,
  thumbnail_url_param VARCHAR(500)
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE files 
  SET thumbnail_url = thumbnail_url_param
  WHERE id = file_uuid;
  
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. View för att få rating-statistik per kund
-- Först ta bort befintlig view för att undvika konflikter
DROP VIEW IF EXISTS customer_rating_stats;

-- Skapa ny view för rating statistik
CREATE VIEW customer_rating_stats AS
SELECT 
  customer_id,
  COUNT(*) as total_files,
  COUNT(CASE WHEN customer_rating = 'favorite' THEN 1 END) as favorites,
  COUNT(CASE WHEN customer_rating = 'good' THEN 1 END) as good,
  COUNT(CASE WHEN customer_rating = 'poor' THEN 1 END) as poor,
  COUNT(CASE WHEN customer_rating = 'unrated' THEN 1 END) as unrated,
  ROUND(
    (COUNT(CASE WHEN customer_rating = 'favorite' THEN 1 END) * 100.0 / COUNT(*)), 
    1
  ) as favorite_percentage
FROM files 
WHERE is_deleted = FALSE
GROUP BY customer_id;

-- 7. Lägg till kommentarer för nya kolumner (om de inte redan finns)
DO $$
BEGIN
    -- Sätt kommentarer för kolumner
    EXECUTE 'COMMENT ON COLUMN files.thumbnail_url IS ''URL till thumbnail version av filen för snabb förhandsvisning''';
    EXECUTE 'COMMENT ON COLUMN files.customer_rating IS ''Kundens betyg på filen: favorite, good, poor, unrated''';
    EXECUTE 'COMMENT ON COLUMN files.customer_notes IS ''Kundens anteckningar om filen''';
    EXECUTE 'COMMENT ON COLUMN files.rating_updated_at IS ''När kunden senast uppdaterade betyget''';
EXCEPTION
    WHEN OTHERS THEN
        -- Ignorera fel om kommentarer redan finns
        NULL;
END $$;

-- 8. Uppdatera alla befintliga filer till att ha default rating 'unrated' om de är NULL
UPDATE files 
SET customer_rating = 'unrated' 
WHERE customer_rating IS NULL;

-- 9. Visa status över nya funktioner
SELECT 
    'thumbnail_url' as column_name,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'thumbnail_url') 
         THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'customer_rating' as column_name,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'customer_rating') 
         THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'customer_notes' as column_name,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'customer_notes') 
         THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'rating_updated_at' as column_name,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'rating_updated_at') 
         THEN 'EXISTS' ELSE 'MISSING' END as status;

-- 10. Exempel på thumbnail namngivning:
-- Original: "customers/customer-uuid/path/image.jpg"
-- Thumbnail: "customers/customer-uuid/path/thumbnails/image_thumb.jpg"

-- Uppdateringen är nu klar! 
-- Alla kolumner och funktioner är redo för thumbnail och betygsättning.
