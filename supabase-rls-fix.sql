-- Tillfällig lösning: Lägg till policies som tillåter admin-operationer
-- Kör detta i Supabase SQL Editor

-- Ta bort befintliga restrictive policies
DROP POLICY IF EXISTS "Customers can view own data" ON customers;
DROP POLICY IF EXISTS "Customers can view own files" ON files;
DROP POLICY IF EXISTS "Admins can view all" ON customers;
DROP POLICY IF EXISTS "Admins can manage all files" ON files;

-- Skapa mer permissiva policies för admin-operationer
-- (I produktion: implementera riktig autentisering)

-- Tillåt alla operationer på customers för nu (för admin-interface)
CREATE POLICY "Allow all operations on customers" ON customers
  FOR ALL USING (true) WITH CHECK (true);

-- Tillåt alla operationer på files för nu (för admin-interface)  
CREATE POLICY "Allow all operations on files" ON files
  FOR ALL USING (true) WITH CHECK (true);

-- Behåll RLS på admin_users för säkerhet
CREATE POLICY "Admin users can manage themselves" ON admin_users
  FOR ALL USING (auth.jwt() ->> 'email' = email);

-- OBS: Detta är en tillfällig lösning för utveckling
-- I produktion måste du implementera riktig autentisering och mer specifika policies
