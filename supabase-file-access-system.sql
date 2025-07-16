-- FILÅTKOMST OCH PRENUMERATIONER: Tidsbegränsad access och permanent köp
-- Denna SQL implementerar 30-dagars gratis period, förlängning och permanent access

DO $$ 
BEGIN
    -- Lägg till access-kolumner i customers tabellen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'access_expires_at') THEN
        ALTER TABLE customers ADD COLUMN access_expires_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added access_expires_at column to customers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'has_permanent_access') THEN
        ALTER TABLE customers ADD COLUMN has_permanent_access BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added has_permanent_access column to customers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'permanent_access_expires_at') THEN
        ALTER TABLE customers ADD COLUMN permanent_access_expires_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added permanent_access_expires_at column to customers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'total_storage_used') THEN
        ALTER TABLE customers ADD COLUMN total_storage_used BIGINT DEFAULT 0;
        RAISE NOTICE 'Added total_storage_used column to customers';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'access_status') THEN
        ALTER TABLE customers ADD COLUMN access_status VARCHAR(20) DEFAULT 'active';
        RAISE NOTICE 'Added access_status column to customers';
    END IF;
END $$;

-- Skapa access_extensions tabell för att logga förlängningar
CREATE TABLE IF NOT EXISTS access_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    extended_by_admin VARCHAR(255), -- admin som förlängde
    extension_days INTEGER NOT NULL, -- 7, 14 eller 30 dagar
    extended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_expiry TIMESTAMP WITH TIME ZONE,
    new_expiry TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skapa permanent_access_purchases tabell för köp av permanent access
CREATE TABLE IF NOT EXISTS permanent_access_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    amount_paid DECIMAL(10,2) DEFAULT 1500.00, -- 1500 kr
    storage_limit_gb INTEGER DEFAULT 500, -- 500 GB limit
    expires_at TIMESTAMP WITH TIME ZONE, -- årlig förnyelse
    payment_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active', -- active, expired, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sätt standardvärden för befintliga kunder (30 dagar från första upload)
UPDATE customers 
SET access_expires_at = (
    SELECT MIN(uploaded_at) + INTERVAL '30 days'
    FROM files 
    WHERE files.customer_id = customers.id
),
access_status = 'active'
WHERE access_expires_at IS NULL 
AND EXISTS (SELECT 1 FROM files WHERE files.customer_id = customers.id);

-- Uppdatera total_storage_used för befintliga kunder
UPDATE customers 
SET total_storage_used = (
    SELECT COALESCE(SUM(file_size), 0)
    FROM files 
    WHERE files.customer_id = customers.id AND is_deleted = FALSE
)
WHERE total_storage_used = 0;

-- Skapa index för prestanda
CREATE INDEX IF NOT EXISTS idx_customers_access_expires_at ON customers(access_expires_at);
CREATE INDEX IF NOT EXISTS idx_customers_access_status ON customers(access_status);
CREATE INDEX IF NOT EXISTS idx_access_extensions_customer_id ON access_extensions(customer_id);
CREATE INDEX IF NOT EXISTS idx_permanent_access_purchases_customer_id ON permanent_access_purchases(customer_id);

-- Lägg till kommentarer för klarhet
COMMENT ON COLUMN customers.access_expires_at IS 'När gratis access upphör (30 dagar från första upload)';
COMMENT ON COLUMN customers.has_permanent_access IS 'Om kunden köpt permanent access';
COMMENT ON COLUMN customers.permanent_access_expires_at IS 'När permanent access upphör (årlig förnyelse)';
COMMENT ON COLUMN customers.total_storage_used IS 'Total filstorlek i bytes för kunden';
COMMENT ON COLUMN customers.access_status IS 'active, expired, locked, permanent';
COMMENT ON TABLE access_extensions IS 'Loggar admin-förlängningar av kundaccess';
COMMENT ON TABLE permanent_access_purchases IS 'Permanent access-köp (1500kr/år för 500GB)';

-- Funktion för att kontrollera kundaccess
CREATE OR REPLACE FUNCTION check_customer_access(customer_uuid UUID)
RETURNS TABLE(
    has_access BOOLEAN,
    access_type VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE,
    days_remaining INTEGER,
    storage_used_gb DECIMAL(10,2),
    storage_limit_gb INTEGER
) AS $$
DECLARE
    customer_record customers%ROWTYPE;
    permanent_purchase permanent_access_purchases%ROWTYPE;
BEGIN
    -- Hämta kunddata
    SELECT * INTO customer_record FROM customers WHERE id = customer_uuid;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'not_found'::VARCHAR(20), NULL::TIMESTAMP WITH TIME ZONE, 0, 0.0, 0;
        RETURN;
    END IF;
    
    -- Kontrollera permanent access först
    SELECT * INTO permanent_purchase 
    FROM permanent_access_purchases 
    WHERE customer_id = customer_uuid 
    AND status = 'active' 
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY expires_at DESC NULLS FIRST
    LIMIT 1;
    
    IF FOUND THEN
        -- Har permanent access
        RETURN QUERY SELECT 
            TRUE,
            'permanent'::VARCHAR(20),
            permanent_purchase.expires_at,
            CASE 
                WHEN permanent_purchase.expires_at IS NULL THEN 999999
                ELSE EXTRACT(DAYS FROM permanent_purchase.expires_at - NOW())::INTEGER
            END,
            (customer_record.total_storage_used / 1024.0 / 1024.0 / 1024.0)::DECIMAL(10,2),
            permanent_purchase.storage_limit_gb;
        RETURN;
    END IF;
    
    -- Kontrollera gratis access
    IF customer_record.access_expires_at IS NULL THEN
        -- Ny kund utan filer än
        RETURN QUERY SELECT TRUE, 'active'::VARCHAR(20), NULL::TIMESTAMP WITH TIME ZONE, 30, 0.0, 0;
        RETURN;
    END IF;
    
    IF customer_record.access_expires_at > NOW() THEN
        -- Gratis access fortfarande aktiv
        RETURN QUERY SELECT 
            TRUE,
            'active'::VARCHAR(20),
            customer_record.access_expires_at,
            EXTRACT(DAYS FROM customer_record.access_expires_at - NOW())::INTEGER,
            (customer_record.total_storage_used / 1024.0 / 1024.0 / 1024.0)::DECIMAL(10,2),
            0; -- Ingen storage limit för gratis
        RETURN;
    ELSE
        -- Access har upphört
        RETURN QUERY SELECT 
            FALSE,
            'expired'::VARCHAR(20),
            customer_record.access_expires_at,
            0,
            (customer_record.total_storage_used / 1024.0 / 1024.0 / 1024.0)::DECIMAL(10,2),
            0;
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger för att uppdatera storage_used när filer läggs till/tas bort
CREATE OR REPLACE FUNCTION update_customer_storage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Ny fil tillagd
        UPDATE customers 
        SET total_storage_used = total_storage_used + NEW.file_size
        WHERE id = NEW.customer_id;
        
        -- Sätt access_expires_at om det är första filen
        UPDATE customers 
        SET access_expires_at = NOW() + INTERVAL '30 days'
        WHERE id = NEW.customer_id 
        AND access_expires_at IS NULL;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Fil uppdaterad (t.ex. markerad som borttagen)
        IF OLD.is_deleted != NEW.is_deleted THEN
            IF NEW.is_deleted THEN
                -- Fil borttagen
                UPDATE customers 
                SET total_storage_used = total_storage_used - OLD.file_size
                WHERE id = OLD.customer_id;
            ELSE
                -- Fil återställd
                UPDATE customers 
                SET total_storage_used = total_storage_used + NEW.file_size
                WHERE id = NEW.customer_id;
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Fil permanent borttagen
        UPDATE customers 
        SET total_storage_used = total_storage_used - OLD.file_size
        WHERE id = OLD.customer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Skapa trigger
DROP TRIGGER IF EXISTS trigger_update_customer_storage ON files;
CREATE TRIGGER trigger_update_customer_storage
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION update_customer_storage();

RAISE NOTICE 'File access system setup complete!';
RAISE NOTICE '- Customers get 30 days free access from first upload';
RAISE NOTICE '- Admins can extend access by 7, 14 or 30 days';  
RAISE NOTICE '- Permanent access available: 1500kr/year for 500GB';
RAISE NOTICE '- Use check_customer_access(uuid) function to check access status';
