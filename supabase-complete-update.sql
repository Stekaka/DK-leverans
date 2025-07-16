-- KOMPLETT DATABAS-UPPDATERING FÖR DK LEVERANS
-- Kör denna i Supabase SQL Editor för att säkerställa att alla kolumner finns
-- SÄKER VERSION - Kolumner läggs bara till om de inte redan finns

-- 1. Säkerställ att alla nödvändiga kolumner finns i files-tabellen
DO $$ 
BEGIN
    -- original_name kolumn (ursprungligt filnamn)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'original_name') THEN
        ALTER TABLE files ADD COLUMN original_name VARCHAR(255);
        RAISE NOTICE 'Added original_name column';
    ELSE
        RAISE NOTICE 'original_name column already exists';
    END IF;
    
    -- folder_path kolumn (mappstruktur)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'folder_path') THEN
        ALTER TABLE files ADD COLUMN folder_path VARCHAR(500) DEFAULT '';
        RAISE NOTICE 'Added folder_path column';
    ELSE
        RAISE NOTICE 'folder_path column already exists';
    END IF;
    
    -- thumbnail_url kolumn (thumbnail-stöd)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'thumbnail_url') THEN
        ALTER TABLE files ADD COLUMN thumbnail_url VARCHAR(500);
        RAISE NOTICE 'Added thumbnail_url column';
    ELSE
        RAISE NOTICE 'thumbnail_url column already exists';
    END IF;
    
    -- customer_rating kolumn (betygsättning)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'customer_rating') THEN
        ALTER TABLE files ADD COLUMN customer_rating VARCHAR(20) DEFAULT 'unrated' CHECK (customer_rating IN ('unrated', 'favorite', 'good', 'poor'));
        RAISE NOTICE 'Added customer_rating column';
    ELSE
        RAISE NOTICE 'customer_rating column already exists';
    END IF;
    
    -- customer_notes kolumn (kundkommentarer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'customer_notes') THEN
        ALTER TABLE files ADD COLUMN customer_notes TEXT;
        RAISE NOTICE 'Added customer_notes column';
    ELSE
        RAISE NOTICE 'customer_notes column already exists';
    END IF;
    
    -- rating_updated_at kolumn (när betyg uppdaterades)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'rating_updated_at') THEN
        ALTER TABLE files ADD COLUMN rating_updated_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added rating_updated_at column';
    ELSE
        RAISE NOTICE 'rating_updated_at column already exists';
    END IF;
    
    -- Kontrollera att cloudflare_url finns (ska finnas från början)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'cloudflare_url') THEN
        ALTER TABLE files ADD COLUMN cloudflare_url TEXT NOT NULL;
        RAISE NOTICE 'Added cloudflare_url column';
    ELSE
        RAISE NOTICE 'cloudflare_url column already exists';
    END IF;
END $$;

-- 2. Skapa index för bättre prestanda (om de inte redan finns)
CREATE INDEX IF NOT EXISTS idx_files_folder_path ON files(customer_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_files_customer_rating ON files(customer_id, customer_rating);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);

-- 3. Visa aktuell tabellstruktur för kontroll
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'files' 
ORDER BY ordinal_position;

-- 4. Visa antal filer per kund för att kontrollera att data finns
SELECT 
    c.name as customer_name,
    c.email,
    COUNT(f.id) as file_count,
    SUM(f.file_size) as total_size_bytes
FROM customers c
LEFT JOIN files f ON c.id = f.customer_id AND f.is_deleted = false
GROUP BY c.id, c.name, c.email
ORDER BY c.name;
