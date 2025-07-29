-- Lägg till tabell för förbyggda ZIP-filer
CREATE TABLE IF NOT EXISTS prebuilt_zips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  zip_path text NOT NULL,
  metadata_path text NOT NULL,
  file_count integer NOT NULL DEFAULT 0,
  zip_size bigint NOT NULL DEFAULT 0,
  built_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index för snabba sökningar
CREATE INDEX IF NOT EXISTS idx_prebuilt_zips_customer_id ON prebuilt_zips(customer_id);
CREATE INDEX IF NOT EXISTS idx_prebuilt_zips_expires_at ON prebuilt_zips(expires_at);

-- Unik constraint - en ZIP per kund
CREATE UNIQUE INDEX IF NOT EXISTS idx_prebuilt_zips_customer_unique ON prebuilt_zips(customer_id);

-- RLS policies
ALTER TABLE prebuilt_zips ENABLE ROW LEVEL SECURITY;

-- Endast admin kan läsa/skriva
CREATE POLICY "Admin can manage prebuilt zips" ON prebuilt_zips
  FOR ALL USING (auth.role() = 'service_role');

-- Kommentar för tabellen
COMMENT ON TABLE prebuilt_zips IS 'Spårar förbyggda ZIP-filer för kunder - skapas automatiskt vid uppladdning';
