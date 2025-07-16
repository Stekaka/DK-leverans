-- LÄGG TILL CREATED_AT KOLUMN I FILES TABELLEN
-- Kör denna om du vill ha konsekvent created_at kolumn i files

-- Lägg till created_at kolumn om den inte finns
ALTER TABLE files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Sätt created_at till uploaded_at för befintliga rader där created_at är null
UPDATE files 
SET created_at = uploaded_at 
WHERE created_at IS NULL;

-- Lägg till index för prestanda
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

-- Kommentar för klarhet
COMMENT ON COLUMN files.created_at IS 'När posten skapades i databasen (samma som uploaded_at för filer)';
