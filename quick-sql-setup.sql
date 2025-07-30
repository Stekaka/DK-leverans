-- Snabb setup för prebuilt_zips tabell
-- Kör detta steg för steg i Supabase SQL Editor

-- Steg 1: Skapa tabellen
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
