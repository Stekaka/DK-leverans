-- 🎯 TEMP DOWNLOADS TABELL
-- För att spåra temporära ZIP-nedladdningar av markerade filer

CREATE TABLE temp_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL, -- Sökväg i R2: temp-downloads/customer-id/timestamp_name.zip
  file_count INTEGER NOT NULL DEFAULT 0,
  original_size BIGINT NOT NULL DEFAULT 0, -- Total storlek av ursprungliga filer
  zip_size BIGINT NOT NULL DEFAULT 0, -- Storlek av ZIP-filen
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Default 10 minuter från skapande
  downloaded_at TIMESTAMP WITH TIME ZONE, -- När filen laddades ner (optional tracking)
  
  -- Index för snabba queries
  INDEX(customer_id),
  INDEX(expires_at)
);

-- RLS policies
ALTER TABLE temp_downloads ENABLE ROW LEVEL SECURITY;

-- Admin kan läsa alla temp downloads
CREATE POLICY "Admin can view all temp downloads" ON temp_downloads
  FOR SELECT USING (true);

-- Admin kan skapa temp downloads
CREATE POLICY "Admin can create temp downloads" ON temp_downloads
  FOR INSERT WITH CHECK (true);

-- Kunder kan bara se sina egna temp downloads
CREATE POLICY "Customers can view own temp downloads" ON temp_downloads
  FOR SELECT USING (
    auth.uid()::text = customer_id::text
  );

-- Auto-cleanup för expired temp downloads (körs av cron job)
-- Detta kommer att rensas automatiskt för att hålla tabellen liten

-- Kommentarer för dokumentation
COMMENT ON TABLE temp_downloads IS 'Temporära ZIP-nedladdningar för markerade filer - förfaller efter 10 minuter';
COMMENT ON COLUMN temp_downloads.file_path IS 'R2 storage path: temp-downloads/customer-id/timestamp_name.zip';
COMMENT ON COLUMN temp_downloads.file_count IS 'Antal markerade filer i ZIP:en';
COMMENT ON COLUMN temp_downloads.original_size IS 'Total storlek av ursprungliga filer före komprimering';
COMMENT ON COLUMN temp_downloads.zip_size IS 'Storlek av den skapade ZIP-filen';
COMMENT ON COLUMN temp_downloads.expires_at IS 'När temp-filen förfaller (default 10 minuter)';
