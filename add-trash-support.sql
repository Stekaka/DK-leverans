# PAPPERSKORG OCH DUBBLETTHANTERING - SQL UPPDATERINGAR

-- Lägg till papperskorg-kolumn i files-tabellen
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_trashed boolean DEFAULT false;

-- Index för prestanda
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(customer_id, is_trashed) WHERE is_trashed = true;
CREATE INDEX IF NOT EXISTS idx_files_active ON files(customer_id, is_deleted, is_trashed) WHERE is_deleted = false AND is_trashed = false;

-- Uppdatera befintliga filer för att sätta is_trashed till false om den är null
UPDATE files SET is_trashed = false WHERE is_trashed IS NULL;

-- Lägg till constraint för att säkerställa boolean-värden
ALTER TABLE files ALTER COLUMN is_trashed SET NOT NULL;

COMMENT ON COLUMN files.is_trashed IS 'Om filen är flyttad till papperskorgen (soft delete för användare)';
