-- 🎯 CUSTOMER BUNDLES TABELL
-- För att lagra metadata om auto-genererade ZIP bundles per kund

CREATE TABLE customer_bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  bundle_path TEXT NOT NULL, -- Sökväg i R2: bundles/customer-id_bundle.zip
  file_count INTEGER NOT NULL DEFAULT 0,
  bundle_size BIGINT NOT NULL DEFAULT 0, -- Storlek i bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Indexer för snabba queries
  UNIQUE(customer_id) -- Endast en aktiv bundle per kund
);

-- Index för snabb lookup
CREATE INDEX idx_customer_bundles_customer_id ON customer_bundles(customer_id);
CREATE INDEX idx_customer_bundles_expires ON customer_bundles(expires_at);

-- RLS policies
ALTER TABLE customer_bundles ENABLE ROW LEVEL SECURITY;

-- Admin kan läsa alla bundles
CREATE POLICY "Admin can view all bundles" ON customer_bundles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE id = customer_bundles.customer_id
    )
  );

-- Admin kan skapa/uppdatera bundles
CREATE POLICY "Admin can manage bundles" ON customer_bundles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE id = customer_bundles.customer_id
    )
  );

-- Kunder kan bara se sina egna bundles
CREATE POLICY "Customers can view own bundles" ON customer_bundles
  FOR SELECT USING (
    auth.uid()::text = customer_id::text
  );

-- Kommentarer för dokumentation
COMMENT ON TABLE customer_bundles IS 'Auto-generated ZIP bundles för customers - skapas när filer laddas upp';
COMMENT ON COLUMN customer_bundles.bundle_path IS 'R2 storage path: bundles/customer-id_bundle.zip';
COMMENT ON COLUMN customer_bundles.file_count IS 'Antal filer i bundle ZIP:en';
COMMENT ON COLUMN customer_bundles.bundle_size IS 'Total storlek av ZIP-filen i bytes';
COMMENT ON COLUMN customer_bundles.expires_at IS 'När bundles förfaller (default 7 dagar)';
