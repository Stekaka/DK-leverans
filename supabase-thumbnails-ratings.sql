-- Lägg till thumbnail och betygsättningsstöd
-- Kör detta i Supabase SQL Editor för att uppdatera befintlig databas

-- 1. Lägg till thumbnail och rating kolumner till files tabell
ALTER TABLE files ADD COLUMN thumbnail_url VARCHAR(500);
ALTER TABLE files ADD COLUMN customer_rating VARCHAR(20) DEFAULT 'unrated' CHECK (customer_rating IN ('unrated', 'favorite', 'good', 'poor'));
ALTER TABLE files ADD COLUMN customer_notes TEXT;
ALTER TABLE files ADD COLUMN rating_updated_at TIMESTAMP WITH TIME ZONE;

-- 2. Index för snabbare sökning på rating
CREATE INDEX idx_files_customer_rating ON files(customer_id, customer_rating);

-- 3. Uppdatera customer_folders view för att inkludera rating statistik
CREATE OR REPLACE VIEW customer_folders AS
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
CREATE OR REPLACE VIEW customer_rating_stats AS
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

-- 7. Kommentarer för nya kolumner
COMMENT ON COLUMN files.thumbnail_url IS 'URL till thumbnail version av filen för snabb förhandsvisning';
COMMENT ON COLUMN files.customer_rating IS 'Kundens betyg på filen: favorite, good, poor, unrated';
COMMENT ON COLUMN files.customer_notes IS 'Kundens anteckningar om filen';
COMMENT ON COLUMN files.rating_updated_at IS 'När kunden senast uppdaterade betyget';

-- 8. Exempel på thumbnail namngivning:
-- Original: "customer-uuid/path/image.jpg"
-- Thumbnail: "customer-uuid/path/thumbnails/image_thumb.jpg"

-- 9. Policy uppdateringar (säkerställ att kunder kan uppdatera sina egna ratings)
-- Customers ska kunna uppdatera rating på sina egna filer
-- Detta hanteras redan av befintliga policies som tillåter allt
