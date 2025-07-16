-- KUNDORGANISATION: Låt kunder organisera sina filer utan att påverka admin-vyn
-- Denna SQL lägger till kolumner för kundspecifik visning

DO $$ 
BEGIN
    -- display_name kolumn (kundvisningsnamn)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'display_name') THEN
        ALTER TABLE files ADD COLUMN display_name VARCHAR(255);
        RAISE NOTICE 'Added display_name column';
    ELSE
        RAISE NOTICE 'display_name column already exists';
    END IF;
    
    -- customer_folder_path kolumn (kundmappstruktur)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'customer_folder_path') THEN
        ALTER TABLE files ADD COLUMN customer_folder_path VARCHAR(500);
        RAISE NOTICE 'Added customer_folder_path column';
    ELSE
        RAISE NOTICE 'customer_folder_path column already exists';
    END IF;
    
    -- organization_updated_at kolumn (när organisation ändrades)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'organization_updated_at') THEN
        ALTER TABLE files ADD COLUMN organization_updated_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added organization_updated_at column';
    ELSE
        RAISE NOTICE 'organization_updated_at column already exists';
    END IF;
END $$;

-- Sätt standardvärden för befintliga filer
UPDATE files 
SET display_name = original_name,
    customer_folder_path = folder_path
WHERE display_name IS NULL OR customer_folder_path IS NULL;

-- Lägg till index för bättre prestanda
CREATE INDEX IF NOT EXISTS idx_files_customer_folder_path ON files(customer_id, customer_folder_path);
CREATE INDEX IF NOT EXISTS idx_files_display_name ON files(customer_id, display_name);

-- Kommentar för klarhet
COMMENT ON COLUMN files.display_name IS 'Filnamn som visas för kunden (kan ändras)';
COMMENT ON COLUMN files.customer_folder_path IS 'Mappstruktur som visas för kunden (kan ändras)';
COMMENT ON COLUMN files.original_name IS 'Ursprungligt filnamn (oförändrat, för admin)';
COMMENT ON COLUMN files.folder_path IS 'Ursprunglig mappstruktur (oförändrad, för admin)';
