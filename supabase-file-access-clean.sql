-- FILÅTKOMST OCH PRENUMERATIONER: Tidsbegränsad access och permanent köp
-- CLEAN VERSION - Utan debug-meddelanden för enkel körning i Supabase

-- Lägg till access-kolumner i customers tabellen
ALTER TABLE customers ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS has_permanent_access BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS permanent_access_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_storage_used BIGINT DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) DEFAULT 'active';

-- Skapa access_extensions tabell för att logga förlängningar
CREATE TABLE IF NOT EXISTS access_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    extended_by_admin VARCHAR(255),
    extension_days INTEGER NOT NULL,
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
    amount_paid DECIMAL(10,2) DEFAULT 1500.00,
    storage_limit_gb INTEGER DEFAULT 500,
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sätt standardvärden för befintliga kunder
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
    SELECT * INTO customer_record FROM customers WHERE id = customer_uuid;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'not_found'::VARCHAR(20), NULL::TIMESTAMP WITH TIME ZONE, 0, 0.0, 0;
        RETURN;
    END IF;
    
    SELECT * INTO permanent_purchase 
    FROM permanent_access_purchases 
    WHERE customer_id = customer_uuid 
    AND status = 'active' 
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY expires_at DESC NULLS FIRST
    LIMIT 1;
    
    IF FOUND THEN
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
    
    IF customer_record.access_expires_at IS NULL THEN
        RETURN QUERY SELECT TRUE, 'active'::VARCHAR(20), NULL::TIMESTAMP WITH TIME ZONE, 30, 0.0, 0;
        RETURN;
    END IF;
    
    IF customer_record.access_expires_at > NOW() THEN
        RETURN QUERY SELECT 
            TRUE,
            'active'::VARCHAR(20),
            customer_record.access_expires_at,
            EXTRACT(DAYS FROM customer_record.access_expires_at - NOW())::INTEGER,
            (customer_record.total_storage_used / 1024.0 / 1024.0 / 1024.0)::DECIMAL(10,2),
            0;
        RETURN;
    ELSE
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

-- Trigger för att uppdatera storage_used
CREATE OR REPLACE FUNCTION update_customer_storage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE customers 
        SET total_storage_used = total_storage_used + NEW.file_size
        WHERE id = NEW.customer_id;
        
        UPDATE customers 
        SET access_expires_at = NOW() + INTERVAL '30 days'
        WHERE id = NEW.customer_id 
        AND access_expires_at IS NULL;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_deleted != NEW.is_deleted THEN
            IF NEW.is_deleted THEN
                UPDATE customers 
                SET total_storage_used = total_storage_used - OLD.file_size
                WHERE id = OLD.customer_id;
            ELSE
                UPDATE customers 
                SET total_storage_used = total_storage_used + NEW.file_size
                WHERE id = NEW.customer_id;
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
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
