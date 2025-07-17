-- PAPPERSKORG SUPPORT - SUPABASE SQL
-- Kör detta i Supabase SQL Editor

-- Lägg till papperskorg-kolumn i files-tabellen
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_trashed boolean DEFAULT false;

-- Uppdatera befintliga filer för att sätta is_trashed till false
UPDATE files SET is_trashed = false WHERE is_trashed IS NULL;

-- Lägg till constraint för att säkerställa boolean-värden
ALTER TABLE files ALTER COLUMN is_trashed SET NOT NULL;

-- Index för prestanda (papperskorg-filer)
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(customer_id, is_trashed) WHERE is_trashed = true;

-- Index för aktiva filer (inte raderade och inte i papperskorgen)
CREATE INDEX IF NOT EXISTS idx_files_active ON files(customer_id, is_deleted, is_trashed) WHERE is_deleted = false AND is_trashed = false;

-- Kommentar för dokumentation
COMMENT ON COLUMN files.is_trashed IS 'Om filen är flyttad till papperskorgen (soft delete för användare)';

-- Verifiera att kolumnen skapades korrekt
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'files' AND column_name = 'is_trashed';
