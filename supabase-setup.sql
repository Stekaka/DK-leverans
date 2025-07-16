-- Supabase databas setup för DK Leverans
-- Kör detta i Supabase SQL Editor

-- 1. Skapa customers tabell
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  project VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255), -- För framtida lösenordshantering
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_access TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Skapa files tabell för fil-metadata
CREATE TABLE files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL, -- Filnamn i Cloudflare R2
  original_name VARCHAR(255) NOT NULL, -- Original filnamn från upload
  file_size BIGINT NOT NULL, -- Storlek i bytes
  file_type VARCHAR(100) NOT NULL, -- MIME type (image/jpeg, video/mp4, etc.)
  cloudflare_url TEXT NOT NULL, -- Full URL till filen i Cloudflare R2
  thumbnail_url TEXT, -- URL till thumbnail (för videos/bilder)
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 3. Skapa admin_users tabell
CREATE TABLE admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- 4. Lägg till index för prestanda
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_files_customer_id ON files(customer_id);
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at);

-- 5. Skapa en funktion för att uppdatera updated_at automatiskt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Lägg till trigger för customers tabell
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Insert sample admin user (lösenord: "admin123" - ändra detta!)
INSERT INTO admin_users (email, password_hash, name) 
VALUES ('admin@dronarkompaniet.se', '$2a$10$rqiU8X8X8X8X8X8X8X8X8e', 'Admin User');

-- 8. Insert några test-kunder (valfritt för test)
INSERT INTO customers (name, email, project, status) VALUES 
('Anna Svensson', 'anna@exempel.se', 'Fastighetsfotografering Villa Danderyd', 'active'),
('Stockholms Byggentreprenad AB', 'info@byggab.se', 'Byggdokumentation Kista', 'active'),
('Maria Lindqvist', 'maria.l@hotmail.com', 'Bröllopsfilm Mariefred', 'expired');

-- 9. Row Level Security (RLS) policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Customers kan bara se sina egna data
CREATE POLICY "Customers can view own data" ON customers
  FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Policy: Customers kan bara se sina egna filer  
CREATE POLICY "Customers can view own files" ON files
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Admins kan se allt (temporär - förbättra senare)
CREATE POLICY "Admins can view all" ON customers
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage all files" ON files
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
